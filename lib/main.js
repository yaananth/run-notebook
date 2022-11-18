"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function findNestedObj(obj, keys) {
    return keys.reduce((o, key) => o && typeof o[key] !== 'undefined' ? o[key] : undefined, obj);
}
// These are added run actions using "env:"
let runner = JSON.parse(process.env.RUNNER || "");
let secrets = JSON.parse(process.env.SECRETS || "");
let github = JSON.parse(process.env.GITHUB || "");
const outputDir = path.join(runner.temp, "nb-runner");
const scriptsDir = path.join(runner.temp, "nb-runner-scripts");
const executeScriptPath = path.join(scriptsDir, "nb-runner.py");
const secretsPath = path.join(runner.temp, "secrets.json");
const papermillOutput = path.join(github.workspace, "papermill-nb-runner.out");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        var parsedNotebookFile;
        var papermillEnvs;
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
            const domain = secrets.NOTEABLE_DOMAIN;
            const token = secrets.NOTEABLE_TOKEN;
            papermillEnvs = {};
            if (typeof domain !== 'undefined') {
                papermillEnvs['NOTEABLE_DOMAIN'] = domain;
            }
            if (typeof token !== 'undefined') {
                papermillEnvs['NOTEABLE_TOKEN'] = token;
                // TODO Fail here if undefined as the papermill command will fail later
            }
            const githubString = JSON.stringify(JSON.parse(process.env.GITHUB || ""));
            parsedNotebookFile = path.join(outputDir, path.basename(notebookFile));
            // Install dependencies
            yield exec.exec('python3 -m pip install papermill-origami papermill>=2.4.0 nbformat>=5.4.0 nbconvert>=7.0.0');
            // Just in case the user want's to execute a local notebook
            yield exec.exec('python3 -m pip install ipykernel');
            yield exec.exec('python3 -m ipykernel install --user');
            // Execute notebook
            const pythonCode = `
import papermill as pm
import os
import json
import sys
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import sleep

logging.basicConfig(level=logging.INFO, format="%(message)s")
# TODO: Figure out why the basic config isn't setting the defaults for structlog
import structlog
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)

params = {}
paramsPath = '${paramsFile}'
github = json.loads('${githubString}')
extraParams = dict({ "secretsPath": '${secretsPath}', "github": github })
if os.path.exists(paramsPath):
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
      engine_name='noteable',
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
        }
        catch (error) {
            core.setFailed(error.message);
        }
        // Not do the actual execution
        try {
            yield exec.exec(`cat ${executeScriptPath}`);
            yield exec.exec(`python3 ${executeScriptPath}`, [], { env: Object.assign(Object.assign({}, process.env), papermillEnvs) });
            // Convert to HTML
            yield exec.exec(`jupyter nbconvert "${parsedNotebookFile}" --to html`);
        }
        catch (error) {
            core.setFailed(error.message);
        }
        finally {
            const notebookObj = JSON.parse(fs.readFileSync(parsedNotebookFile, 'utf8'));
            const executionURL = notebookObj.metadata.executed_notebook_url;
            if (executionURL) {
                yield exec.exec(`echo "Notebook run can be found at ${executionURL}"`);
            }
        }
    });
}
run();
