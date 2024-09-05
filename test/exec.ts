import * as fs from "fs";

import { Runtime } from "../source/runtime.js";

const SOURCE_PATH = "sample/program.nfex";

const source = fs.readFileSync(SOURCE_PATH, "utf8");

const runtime = new Runtime();

runtime.lexecute(source);
