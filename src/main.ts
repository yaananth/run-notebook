import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from "fs";
import * as path from "path";

interface IRunnerContext {
  os: string;
  tool_cache: string;
  temp: string;
  workspace: string;
}

interface IGithubContext {
  workspace: string;
}

// These are added run actions using "env:"
let runner: IRunnerContext = JSON.parse(process.env.RUNNER || "");
let secrets: any = JSON.parse(process.env.SECRETS || "");
let github: IGithubContext = JSON.parse(process.env.GITHUB || "");

const outputDir = path.join(runner.temp, "nb-runner");
const scriptsDir = path.join(runner.temp, "nb-runner-scripts");
const executeScriptPath = path.join(scriptsDir, "nb-runner.py");
const secretsPath = path.join(runner.temp, "secrets.json");
const papermillOutput = path.join(github.workspace, "papermill-nb-runner.out");

async function run() {github
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
    var papermillEnvs = {};
    if (typeof domain !== 'undefined') {
      papermillEnvs['NOTEABLE_DOMAIN'] = domain;
    }
    if (typeof token !== 'undefined') {
      papermillEnvs['NOTEABLE_TOKEN'] = token;
      // TODO Fail here if undefined as the papermill command will fail later
    }
    const githubUnparsed = process.env.GITHUB || ""

    const parsedNotebookFile = path.join(outputDir, path.basename(notebookFile));
    // Install dependencies
    await exec.exec('python3 -m pip install papermill-origami papermill>=2.4.0 nbformat>=5.4.0 nbconvert>=7.0.0');

    // Execute notebook
    const pythonCode = `
import papermill as pm
import os
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import sleep

params = {}
paramsPath = '${paramsFile}'
github = json.loads('${githubUnparsed}')
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
      engine='noteable',
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

    await exec.exec(`cat ${executeScriptPath}`)
    await exec.exec(`python3 ${executeScriptPath}`, [], { env: { ...process.env, ...papermillEnvs } });

    // Convert to HTML
    await exec.exec(`jupyter nbconvert "${parsedNotebookFile}" --to html`);

  } catch (error) {
    core.setFailed((error as any).message);
  }
}

run();
