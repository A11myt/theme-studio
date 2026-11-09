// VS-Code-Theme aus der Palette: Oberfläche wie deine matugen-Vorlage (vscode-colors.json),
// dazu Syntax-Farben – verpackt als installierbare Erweiterung (.vsix) oder als settings.json-Auszug.
import { strToU8, zipSync } from "fflate";
import type { Palette, ThemeSettings } from "./color";
import type { Fonts } from "./fonts";
import { renderTemplate } from "./exporters";
import TEMPLATE from "./vscode-colors.template.json?raw";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme";

/** Syntax-Hervorhebung in den Theme-Farben (TextMate-Scopes + semantische Tokens). */
function tokenColors(c: Palette) {
  const rule = (scope: string | string[], foreground: string, fontStyle?: string) =>
    ({ scope, settings: fontStyle ? { foreground, fontStyle } : { foreground } });
  return [
    rule(["comment", "punctuation.definition.comment"], c.outline, "italic"),
    rule(["keyword", "storage.type", "storage.modifier", "keyword.control"], c.primary),
    rule(["keyword.operator", "punctuation.accessor"], c.on_surface_variant),
    rule(["string", "string.quoted", "string.template"], c.tertiary),
    rule(["constant.numeric", "constant.language", "constant.character"], c.tertiary_fixed_dim),
    rule(["entity.name.function", "support.function", "meta.function-call"], c.secondary),
    rule(["entity.name.type", "entity.name.class", "support.type", "support.class"], c.primary_fixed_dim),
    rule(["variable", "meta.definition.variable"], c.on_surface),
    rule(["variable.parameter"], c.on_surface_variant, "italic"),
    rule(["variable.other.property", "support.variable.property", "meta.object-literal.key"], c.secondary_fixed_dim),
    rule(["entity.name.tag"], c.primary),
    rule(["entity.other.attribute-name"], c.secondary),
    rule(["markup.heading", "entity.name.section"], c.primary, "bold"),
    rule(["markup.bold"], c.on_surface, "bold"),
    rule(["markup.italic"], c.on_surface, "italic"),
    rule(["markup.inline.raw", "markup.fenced_code"], c.tertiary),
    rule(["markup.underline.link"], c.secondary),
    rule(["invalid", "invalid.illegal"], c.error),
  ];
}

export function vscodeTheme(name: string, t: ThemeSettings, c: Palette) {
  return {
    name,
    type: t.mode === "dark" ? "dark" : "light",
    colors: JSON.parse(renderTemplate(TEMPLATE, t)),
    tokenColors: tokenColors(c),
    semanticHighlighting: true,
    semanticTokenColors: {
      function: c.secondary, method: c.secondary, type: c.primary_fixed_dim, class: c.primary_fixed_dim,
      parameter: c.on_surface_variant, property: c.secondary_fixed_dim, keyword: c.primary, string: c.tertiary,
      number: c.tertiary_fixed_dim, comment: c.outline,
    },
  };
}

/** settings.json-Auszug: Theme auswählen + Schriften (wie fontgen: editor/terminal = mono). */
export function vscodeSettings(name: string, f: Fonts) {
  const px = Math.round((f.monoSize * 4) / 3);
  return {
    "workbench.colorTheme": name,
    ...(f.mono ? {
      "editor.fontFamily": `'${f.mono}', monospace`,
      "editor.fontSize": px,
      "terminal.integrated.fontFamily": `'${f.mono}'`,
      "terminal.integrated.fontSize": px,
    } : {}),
  };
}

/** Installierbare Erweiterung: `code --install-extension <datei>.vsix` (oder in VS Code: Erweiterungen → … → Aus VSIX installieren). */
export function vscodeVsix(name: string, t: ThemeSettings, c: Palette): { filename: string; bytes: Uint8Array } {
  const id = `studio-${slug(name)}`;
  const version = "1.0.0";
  const esc = (s: string) => s.replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[ch]!);
  const pkg = {
    name: id, displayName: `${name} (Theme Studio)`, description: `${t.scheme}, ${t.mode} – aus Theme Studio`,
    version, publisher: "theme-studio", engines: { vscode: "^1.70.0" }, categories: ["Themes"],
    contributes: { themes: [{ label: name, uiTheme: t.mode === "dark" ? "vs-dark" : "vs", path: "./themes/theme.json" }] },
  };
  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${id}" Version="${version}" Publisher="theme-studio" />
    <DisplayName>${esc(pkg.displayName)}</DisplayName>
    <Description xml:space="preserve">${esc(pkg.description)}</Description>
    <Categories>Themes</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.70.0" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
`;
  const types = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension=".json" ContentType="application/json" /><Default Extension=".vsixmanifest" ContentType="text/xml" /></Types>
`;
  const bytes = zipSync({
    "[Content_Types].xml": strToU8(types),
    "extension.vsixmanifest": strToU8(manifest),
    "extension/package.json": strToU8(JSON.stringify(pkg, null, 2)),
    "extension/themes/theme.json": strToU8(JSON.stringify(vscodeTheme(name, t, c), null, 2)),
  });
  return { filename: `${id}-${version}.vsix`, bytes };
}
