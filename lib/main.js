"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// These are added run actions using "env:"
let runner = JSON.parse(process.env.RUNNER || "");
const outputDir = path.join(runner.temp, "nb-runner");
const scriptsDir = path.join(runner.temp, "nb-runner-scripts");
const executeScriptPath = path.join(scriptsDir, "nb-runner.py");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const notebookFile = core.getInput('notebook');
            const paramsFile = core.getInput('params');
            fs.mkdirSync(outputDir);
            fs.mkdirSync(scriptsDir);
            const parsedNotebookFile = path.join(outputDir, notebookFile);
            // Install dependencies
            yield exec.exec('python3 -m pip install papermill ipykernel nbformat nbconvert');
            yield exec.exec('sudo python3 -m ipykernel install');
            // Execute notebook
            const pythonCode = `
import papermill as pm
import json

params = {}
paramsPath = '${paramsFile}'

if paramsPath:
  with open('params.json', 'r') as paramsFile:
    params = json.loads(paramsFile.read())
pm.execute_notebook(
    '${notebookFile}',
    '${parsedNotebookFile}',
    parameters = dict(params)
)`;
            fs.writeFileSync(executeScriptPath, pythonCode);
            yield exec.exec(`cat ${executeScriptPath}`);
            yield exec.exec(`python3 ${executeScriptPath}`);
            // Convert to HTML
            yield exec.exec(`jupyter nbconvert ${parsedNotebookFile} --to html`);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
