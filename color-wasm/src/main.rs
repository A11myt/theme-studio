// Gegenprobe auf der Kommandozeile: cargo run --release -- bild.jpg
fn main() {
    let path = std::env::args().nth(1).expect("Bild angeben");
    let bytes = std::fs::read(&path).expect("Bild lesen");
    for c in studio_color::source_colors(&bytes).expect("auswerten") {
        println!("{c}");
    }
}
