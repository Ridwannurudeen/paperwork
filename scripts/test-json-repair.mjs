// Quick verification that the JSON-repair fallback handles the cases
// users would actually hit (model emitting raw control chars in strings).

function escapeUnescapedControlChars(s) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (inString && ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        if (code === 0x0a) out += "\\n";
        else if (code === 0x0d) out += "\\r";
        else if (code === 0x09) out += "\\t";
        else if (code === 0x08) out += "\\b";
        else if (code === 0x0c) out += "\\f";
        else out += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
    }
    out += ch;
  }
  return out;
}

let passed = 0;
function check(name, broken, expected) {
  const repaired = escapeUnescapedControlChars(broken);
  let parsed;
  try {
    parsed = JSON.parse(repaired);
  } catch (e) {
    console.log("  FAIL", name, "— still unparseable:", e.message);
    return;
  }
  if (JSON.stringify(parsed) === JSON.stringify(expected)) {
    console.log("  PASS", name);
    passed++;
  } else {
    console.log("  FAIL", name, "— got", parsed, "want", expected);
  }
}

// 1) Bare LF inside a string value
check("LF inside string", '{"a":"line1\nline2"}', { a: "line1\nline2" });
// 2) CR + LF
check("CRLF inside string", '{"a":"line1\r\nline2"}', { a: "line1\r\nline2" });
// 3) Tab inside string
check("TAB inside string", '{"x":"col1\tcol2"}', { x: "col1\tcol2" });
// 4) Already-valid JSON should be a no-op
check("valid stays valid", '{"a":1,"b":[1,2,3]}', { a: 1, b: [1, 2, 3] });
// 5) Whitespace OUTSIDE strings (newlines between members) is untouched
check(
  "newline between members",
  '{\n  "a": 1,\n  "b": 2\n}',
  { a: 1, b: 2 },
);
// 6) Escaped quote inside string survives
check(
  "escaped quote",
  '{"a":"he said \\"hi\\""}',
  { a: 'he said "hi"' },
);
// 7) The actual shape from the user's analyze failure (LF inside why_it_fits item)
const real =
  '{"options":[{"id":"x","why_it_fits":["first line\n needs escape","second"]}]}';
check("real-shape failure", real, {
  options: [{ id: "x", why_it_fits: ["first line\n needs escape", "second"] }],
});

console.log(`\n${passed}/7 tests passed`);
process.exit(passed === 7 ? 0 : 1);
