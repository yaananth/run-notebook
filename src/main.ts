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
let env: any = JSON.parse(process.env.ENVIRONMENT || "");

const outputDir = path.join(runner.temp, "nb-runner");
const scriptsDir = path.join(runner.temp, "nb-runner-scripts");
const executeScriptPath = path.join(scriptsDir, "nb-runner.py");
const envScriptPath = path.join(scriptsDir, "environment.env");
const secretsPath = path.join(runner.temp, "secrets.json");
const papermillOutput = path.join(github.workspace, "papermill-nb-runner.out");
const requirements = 'requirements.txt';
const requirementsFile = path.join(github.workspace, requirements);


async function run() {
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
    // Install dependencies
    await exec.exec('pip install --upgrade setuptools');
    if (fs.existsSync(requirementsFile)){
      await exec.exec(`python3 -m pip install -r ${requirementsFile}`)
    }
    await exec.exec('python3 -m pip install papermill ipykernel nbformat');
    await exec.exec('python3 -m ipykernel install --user');

    // Execute notebook
    const pythonCode = `
import papermill as pm
import os
from os import path, system
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import sleep

params = {}
paramsPath = '${paramsFile}'
extraParams = dict({ "secretsPath": '${secretsPath}' })
if paramsPath and path.exists(paramsPath):
  with open(paramsPath, 'r') as paramsFile:
    params = json.loads(paramsFile.read())

isDone = False
def watch():
    global isDone
    while not isDone:
      sleep(15)
      system('echo "***Polling latest output status result***"')
      system('tail -n 15 ${papermillOutput}')
      system('echo "***End of polling latest output status result***"')

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

    // set up env vars
    console.log('env', env);
    console.log(`typeof env: ${typeof env}`)
    console.log(`env string: ${JSON.stringify(env)}`);
    const envScript = env.keys().reduce((cmd: string, key: string ) => {
      return `${cmd}
      export ${key}=${env[key]}`
    },  '');
    console.log(`envScript`,envScript);

    fs.writeFileSync(envScriptPath, envScript)
    await exec.exec(`cat ${executeScriptPath}`)
    await exec.exec(`source ${envScriptPath} && python3 ${executeScriptPath}`);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
