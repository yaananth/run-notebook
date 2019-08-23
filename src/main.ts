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

// These are added run actions using "env:"
let runner: IRunnerContext = JSON.parse(process.env.RUNNER || "");
let secrets: any = JSON.parse(process.env.SECRETS || "");
const outputDir = path.join(runner.temp, "nb-runner");
const scriptsDir = path.join(runner.temp, "nb-runner-scripts");
const executeScriptPath = path.join(scriptsDir, "nb-runner.py");
const secretsPath = path.join(runner.temp, "secrets.json");

async function run() {
  try {
    const notebookFile = core.getInput('notebook');
    const paramsFile = core.getInput('params');
    const isReport = core.getInput('isReport');

    fs.mkdirSync(outputDir);
    fs.mkdirSync(scriptsDir);

    fs.writeFileSync(secretsPath, JSON.stringify(secrets));

    const parsedNotebookFile = path.join(outputDir, notebookFile);
    // Install dependencies
    await exec.exec('python3 -m pip install papermill ipykernel nbformat nbconvert');
    await exec.exec('python3 -m ipykernel install --user');

    // Execute notebook
    const pythonCode = `
import papermill as pm
import json
import concurrent.futures

params = {}
paramsPath = '${paramsFile}'
extraParams = dict({ "secretsPath": '${secretsPath}' })
if paramsPath:
  with open('params.json', 'r') as paramsFile:
    params = json.loads(paramsFile.read())

pm.execute_notebook(
  input_path='${notebookFile}',
  output_path='${parsedNotebookFile}',
  parameters=dict(extraParams, **params),
  log_output=True,
  report_mode=${isReport?"True":"False"}
)
`;

    fs.writeFileSync(executeScriptPath, pythonCode);

    await exec.exec(`cat ${executeScriptPath}`)
    await exec.exec(`python3 ${executeScriptPath}`);

    // Convert to HTML
    await exec.exec(`jupyter nbconvert ${parsedNotebookFile} --to html`);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
