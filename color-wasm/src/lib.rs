//! Ausgangsfarben eines Bildes – Schritt für Schritt wie matugen 4.2
//! (`get_scored_colors_from_image` in matugen/src/color/color.rs), mit derselben Bibliothek material-colors 0.4.2.
//! Als WebAssembly im Browser nutzbar → exakt dieselben Farben wie `matugen image … --show-source-colors`.
use material_colors::{
    hct::Cam16,
    image::{AsPixels, FilterType, ImageReader},
    quantize::{Quantizer, QuantizerCelebi},
    score::Score,
};
use wasm_bindgen::prelude::*;

/// Bilddatei (Bytes: jpg/png/webp …) → bis zu 4 Ausgangsfarben als "#rrggbb".
pub fn source_colors(bytes: &[u8]) -> Result<Vec<String>, String> {
    let mut image = ImageReader::read(bytes.to_vec()).map_err(|e| e.to_string())?;
    image.resize(112, 112, FilterType::Triangle);          // matugen-Standard: --resize-filter triangle
    let pixels: Vec<_> = image.as_pixels().iter().copied().filter(|argb| argb.alpha == 255).collect();
    let mut result = QuantizerCelebi::quantize(&pixels, 128);
    result.color_to_count.retain(|&argb, _| Cam16::from(argb).chroma >= 5.0);
    Ok(Score::score(&result.color_to_count, None, None, None)
        .into_iter()
        .map(|c| format!("#{:02x}{:02x}{:02x}", c.red, c.green, c.blue))
        .collect())
}

#[wasm_bindgen(js_name = sourceColors)]
pub fn source_colors_js(bytes: &[u8]) -> Result<Vec<String>, JsError> {
    source_colors(bytes).map_err(|e| JsError::new(&e))
}
