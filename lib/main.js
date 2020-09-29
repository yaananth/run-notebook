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
let secrets = JSON.parse(process.env.SECRETS || "");
let github = JSON.parse(process.env.GITHUB || "");
const condaEnv = "nb-runner";
const envrionmentFileName = "environment.yml";
const outputDir = path.join(runner.temp, "nb-runner");
const scriptsDir = path.join(runner.temp, "nb-runner-scripts");
const executeScriptPath = path.join(scriptsDir, "nb-runner.py");
const secretsPath = path.join(runner.temp, "secrets.json");
const papermillOutput = path.join(github.workspace, "papermill-nb-runner.out");
const condaEnvironmentFile = path.join(github.workspace, envrionmentFileName);
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const notebookFile = core.getInput('notebook');
            const paramsFile = core.getInput('params');
            const isReport = core.getInput('isReport');
            const poll = core.getInput('poll');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }
            if (!fs.existsSync(scriptsDir)) {
                fs.mkdirSync(scriptsDir);
            }
            fs.writeFileSync(secretsPath, JSON.stringify(secrets));
            const parsedNotebookFile = path.join(outputDir, path.basename(notebookFile));
            if (fs.existsSync(condaEnvironmentFile)) {
                yield exec.exec(`conda env create -n ${condaEnv} --file ${condaEnvironmentFile}`);
            }
            // Install dependencies
            yield exec.exec('pip install --upgrade setuptools');
            yield exec.exec('python3 -m pip install papermill ipykernel nbformat');
            yield exec.exec('python3 -m ipykernel install --user');
            // Execute notebook
            const pythonCode = `
import papermill as pm
import os
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import sleep

conda env list
conda env export --from-history

params = {}
paramsPath = '${paramsFile}'
extraParams = dict({ "secretsPath": '${secretsPath}' })
if paramsPath:
  with open(paramsPath, 'r') as paramsFile:
    params = json.loads(paramsFile.read())

isDone = False
def watch():
    global isDone
    while not isDone:
      sleep(15)
      os.system('echo "***Polling latest output status result***"')
      os.system('tail -n 15 ${papermillOutput}')
      os.system('echo "***End of polling latest output status result***"')

def run():
  global isDone
  try:
    pm.execute_notebook(
      input_path='${notebookFile}',
      output_path='${parsedNotebookFile}',
      parameters=dict(extraParams, **params),
      log_output=True,
      report_mode=${!!isReport ? "True" : "False"}
    )
  finally:
    isDone = True

results = []
with ThreadPoolExecutor() as executor:
  results.append(executor.submit(run))
  if ${!!poll ? "True" : "False"}:
    results.append(executor.submit(watch))

for task in as_completed(results):
  try:
    task.result()
  except Exception as e:
    print(e, file=sys.stderr)
    sys.exit(1)
`;
            fs.writeFileSync(executeScriptPath, pythonCode);
            yield exec.exec(`cat ${executeScriptPath}`);
            //await exec.exec(`python3 ${executeScriptPath}`);
            yield exec.exec(`conda run -n ${condaEnv} python3 ${executeScriptPath}`);
            // Convert to HTML
            //await exec.exec(`jupyter nbconvert "${parsedNotebookFile}" --to html`);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
