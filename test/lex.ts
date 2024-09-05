import * as fs from "fs";

import { lex } from "../source/lexer.js";

const SOURCE_PATH = "sample/program.nfex";

const source = fs.readFileSync(SOURCE_PATH, "utf8");

const tokens = lex(source);

console.table(tokens);
