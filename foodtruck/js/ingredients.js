// Pulls the ingredient NAMES out of recipe text and drops the amounts ("2 cups flour" -> "Flour").
// It works on text the restaurant pastes or loads from a .txt file. The result is always shown for the
// restaurant to check and fix before it is saved, because no automatic reader is perfect.
(function () {
  var UNITS = ['cup', 'cups', 'c', 'tbsp', 'tbsps', 'tbs', 'tablespoon', 'tablespoons', 'tsp', 'tsps', 'teaspoon', 'teaspoons', 'oz', 'ounce', 'ounces',
    'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'mg', 'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'litre', 'litres',
    'pint', 'pints', 'pt', 'quart', 'quarts', 'qt', 'gallon', 'gallons', 'gal', 'pinch', 'pinches', 'dash', 'dashes', 'clove', 'cloves', 'slice', 'slices',
    'stick', 'sticks', 'can', 'cans', 'package', 'packages', 'pkg', 'pkgs', 'bunch', 'bunches', 'sprig', 'sprigs', 'head', 'heads', 'piece', 'pieces',
    'large', 'medium', 'small', 'whole', 'handful', 'handfuls', 'splash', 'splashes', 'fl', 'x', 'each', 'about', 'approx', 'approximately', 'heaping', 'scant', 'level'];
  var STOP_AT = /^\W*(instructions?|directions?|method|steps?|preparation|procedure|notes?|nutrition)\b\W*$/i;
  var START_AT = /^\W*ingredients?\b\W*(.*)$/i;

  function isQty(w) { return /^[\d.,\/¼½¾⅓⅔⅛\-–~]+$/.test(w) || /^\d+(\.\d+)?(g|kg|mg|ml|l|oz|lb|lbs|c|cups?|tbsp|tsp)\.?$/i.test(w); }
  function clean(line) {
    var t = String(line || '').replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
    t = t.replace(/^[\s•·*\-–—●○□☐☑✓>#]+/, '');
    t = t.replace(/^\d+[.)]\s+(?=\D)/, '');            // "1) item"
    var words = t.split(/\s+/).filter(Boolean), i = 0, seenQty = false;
    while (i < words.length) {
      var w = words[i].toLowerCase().replace(/[.,:;]+$/, '');
      if (isQty(w)) { seenQty = true; i++; continue; }
      if (seenQty && (w === 'to' || w === 'or' || w === 'of' || w === 'and') ) { i++; continue; }
      if ((seenQty || i === 0) && UNITS.indexOf(w) >= 0 && i < words.length - 1) { if (w !== 'c' && w !== 'x' && w !== 'l' && w !== 'g' && w !== 'can' && w !== 'head' && w !== 'whole' && w !== 'large' && w !== 'medium' && w !== 'small' || seenQty) { i++; continue; } }
      break;
    }
    t = words.slice(i).join(' ');
    t = t.split(/[,;]| - | – | — /)[0];               // drop "diced", "to taste" and other notes after a comma
    t = t.replace(/\b(to taste|as needed|for garnish|for serving|optional)\b.*$/i, '');
    t = t.replace(/^(of|the)\s+/i, '').replace(/[\s:.\-]+$/, '').trim();
    if (!t || t.length > 60 || !/[a-z]/i.test(t)) return '';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function looksLikeStep(line) {
    var words = line.trim().split(/\s+/);
    return words.length > 9 || (/[.!?]$/.test(line.trim()) && words.length > 5);
  }
  function extract(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); });
    var from = -1, to = lines.length, first = '';
    for (var i = 0; i < lines.length; i++) { var m = lines[i].match(START_AT); if (m && lines[i].length < 40) { from = i; first = m[1]; break; } }
    var body;
    if (from >= 0) {
      for (var j = from + 1; j < lines.length; j++) if (STOP_AT.test(lines[j])) { to = j; break; }
      body = (first ? [first] : []).concat(lines.slice(from + 1, to));
    } else {
      body = [];
      for (var k = 0; k < lines.length; k++) { if (STOP_AT.test(lines[k])) break; body.push(lines[k]); }
    }
    var seen = {}, out = [];
    body.forEach(function (l) {
      if (!l || (from < 0 && looksLikeStep(l)) || (from >= 0 && l.split(/\s+/).length > 14)) return;
      var c = clean(l), key = c.toLowerCase();
      if (c && !seen[key]) { seen[key] = 1; out.push(c); }
    });
    return out.slice(0, 80);
  }
  window.vingredients = { extract: extract, clean: clean };
})();
