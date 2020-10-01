import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

async function run() {
  try {
    const workspace = core.getInput('workspace');
    const papermillOutput = path.join(workspace, "papermill-nb-runner.out");

    const requirements = 'requirements.txt';
    const requirementsFile = path.join(workspace, requirements);

    const temp_dir = core.getInput('temp_dir');
    const outputDir = path.join(temp_dir, "nb-runner");
    const scriptsDir = path.join(temp_dir, "nb-runner-scripts");

    const notebookFilesPattern = core.getInput('notebooks');
    const notebookFiles = glob.sync(path.join(workspace, notebookFilesPattern));

    const isReport = core.getInput('isReport');
    const poll = core.getInput('poll');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir);
    }

    // Install dependencies
    await exec.exec('pip install --upgrade setuptools');
    if (fs.existsSync(requirementsFile)){
      await exec.exec(`python3 -m pip install -r ${requirementsFile}`)
    }
    await exec.exec('python3 -m pip install papermill ipykernel nbformat');
    await exec.exec('python3 -m ipykernel install --user');

    // Execute notebooks
    await Promise.all(notebookFiles.map(async (notebookFile: string, index: number) => {
      const executeScriptPath = path.join(scriptsDir, `nb-runner-${index}.py`);
      const parsedNotebookFile = path.join(outputDir, path.basename(notebookFile));

      const pythonCode = `
import papermill as pm
import os
from os import path, system
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import sleep

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

      await exec.exec(`cat ${executeScriptPath}`)
      await exec.exec(`python3 ${executeScriptPath}`);
    })).catch((error) => {
      core.setFailed(error.message);
    });

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
