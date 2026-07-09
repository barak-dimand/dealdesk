import { letterToColumn } from "./types";

/**
 * Minimal spreadsheet formula evaluator: =SUM(B2:B10), =AVERAGE(B2:B10),
 * =B2+B3, =B2*1.1, parentheses and + - * /. Cell values are resolved via the
 * provided getter (visual coordinates: column letter → visible column index,
 * row number → 1-based visual row index). No eval/Function — tiny recursive
 * descent parser.
 */
export function evaluateFormula(
  formula: string,
  getCell: (r: number, c: number) => number
): number | null {
  let expr = formula.trim();
  if (expr.startsWith("=")) expr = expr.slice(1);

  // Expand SUM/AVERAGE(range) into literals
  expr = expr.replace(
    /(SUM|AVERAGE)\(\s*([A-Z]+)(\d+)\s*:\s*([A-Z]+)(\d+)\s*\)/gi,
    (_m, fn: string, c1: string, r1: string, c2: string, r2: string) => {
      const colA = letterToColumn(c1);
      const colB = letterToColumn(c2);
      const rowA = parseInt(r1, 10) - 1;
      const rowB = parseInt(r2, 10) - 1;
      const values: number[] = [];
      for (let r = Math.min(rowA, rowB); r <= Math.max(rowA, rowB); r++) {
        for (let c = Math.min(colA, colB); c <= Math.max(colA, colB); c++) {
          values.push(getCell(r, c));
        }
      }
      const sum = values.reduce((s, v) => s + v, 0);
      const result = fn.toUpperCase() === "SUM" ? sum : values.length ? sum / values.length : 0;
      return String(result);
    }
  );

  // Replace single-cell refs (B2) with values
  expr = expr.replace(/([A-Z]+)(\d+)/gi, (_m, col: string, row: string) => {
    return String(getCell(parseInt(row, 10) - 1, letterToColumn(col)));
  });

  return parseArithmetic(expr);
}

export function isFormula(raw: string): boolean {
  return raw.trim().startsWith("=");
}

// ─── tiny arithmetic parser: numbers, + - * /, parentheses, unary minus ──────

function parseArithmetic(input: string): number | null {
  const tokens = tokenize(input);
  if (!tokens) return null;
  const state = { tokens, pos: 0 };
  const value = parseExpr(state);
  if (value == null || state.pos !== tokens.length) return null;
  return Number.isFinite(value) ? value : null;
}

type Token = { kind: "num"; value: number } | { kind: "op"; value: string };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[\d.]/.test(ch)) {
      let j = i;
      while (j < input.length && /[\d.]/.test(input[j])) j++;
      const num = Number(input.slice(i, j));
      if (Number.isNaN(num)) return null;
      tokens.push({ kind: "num", value: num });
      i = j;
    } else if ("+-*/()".includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i++;
    } else {
      return null; // unknown character
    }
  }
  return tokens;
}

interface ParseState {
  tokens: Token[];
  pos: number;
}

function parseExpr(s: ParseState): number | null {
  let left = parseTerm(s);
  if (left == null) return null;
  while (s.pos < s.tokens.length) {
    const t = s.tokens[s.pos];
    if (t.kind === "op" && (t.value === "+" || t.value === "-")) {
      s.pos++;
      const right = parseTerm(s);
      if (right == null) return null;
      left = t.value === "+" ? left + right : left - right;
    } else {
      break;
    }
  }
  return left;
}

function parseTerm(s: ParseState): number | null {
  let left = parseFactor(s);
  if (left == null) return null;
  while (s.pos < s.tokens.length) {
    const t = s.tokens[s.pos];
    if (t.kind === "op" && (t.value === "*" || t.value === "/")) {
      s.pos++;
      const right = parseFactor(s);
      if (right == null) return null;
      left = t.value === "*" ? left * right : left / right;
    } else {
      break;
    }
  }
  return left;
}

function parseFactor(s: ParseState): number | null {
  const t = s.tokens[s.pos];
  if (!t) return null;
  if (t.kind === "num") {
    s.pos++;
    return t.value;
  }
  if (t.kind === "op" && t.value === "-") {
    s.pos++;
    const v = parseFactor(s);
    return v == null ? null : -v;
  }
  if (t.kind === "op" && t.value === "(") {
    s.pos++;
    const v = parseExpr(s);
    if (v == null) return null;
    const close = s.tokens[s.pos];
    if (!close || close.kind !== "op" || close.value !== ")") return null;
    s.pos++;
    return v;
  }
  return null;
}
