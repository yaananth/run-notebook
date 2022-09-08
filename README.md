# Run notebook
## Usage

This github action runs a jupyter notebook, parameterizes it using [papermill](https://github.com/yaananth/papermill) and lets you upload produced output as artifact using [upload artifact action](https://github.com/marketplace/actions/upload-artifact)

**Note:** Notebook should be using a [parameterized cell](https://github.com/nteract/papermill#parameterizing-a-notebook), this action will inject parameters.

**Note**: This action produces output to a directory called `nb-runner` under runner's temp directory.

**Note**: This action injects a new parameter called `secretsPath` which is a json file with secrets dumped.

### Example 1 - executing notebook with parameters
```
name: Execute notebook

on: [push]

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v3
    - uses: yaananth/run-notebook@v2
      env:
        RUNNER: ${{ toJson(runner) }}
        SECRETS: ${{ toJson(secrets) }}
        GITHUB: ${{ toJson(github) }}
      with:
        notebook: "PATHTONOTEBOOK.ipynb"
        params: "PATHTOPARAMS.json"
        isReport: False
        poll: True
    - uses: actions/upload-artifact@v3
      if: always()
      with:
        name: output
        path: ${{ RUNNER.temp }}/nb-runner
      env:
        RUNNER: ${{ toJson(runner) }}

```
### Example 2 - chaining notebooks

This has nothing to do with action, but just as an example, make use of [scrapbook](https://github.com/nteract/scrapbook)

```
name: Execute notebook

on: [push]

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v3
    - uses: yaananth/run-notebook@v2
      env:
        RUNNER: ${{ toJson(runner) }}
        SECRETS: ${{ toJson(secrets) }}
        GITHUB: ${{ toJson(github) }}
      with:
        notebook: "notebook1.ipynb"
        params: "PATHTOPARAMS.json"
        isReport: False
        poll: True
    - uses: yaananth/run-notebook@v2
      env:
        RUNNER: ${{ toJson(runner) }}
        SECRETS: ${{ toJson(secrets) }}
        GITHUB: ${{ toJson(github) }}
      with:
        notebook: "notebook2.ipynb"
    - uses: actions/upload-artifact@v3
      if: always()
      with:
        name: output
        path: ${{ RUNNER.temp }}/nb-runner
      env:
        RUNNER: ${{ toJson(runner) }}
```

In `notebook1`:

```
!pip install nteract-scrapbook

import uuid
output = str(uuid.uuid4())

import scrapbook as sb
sb.glue("output", output)
```

In `notebook2` :

```
import scrapbook as sb
nb = sb.read_notebook('test.ipynb')
chained = nb.scraps["output"].data
print(chained)
```

## Parameters
- `notebook`: notebook file path to parameterize and execute
- `params`: params file path to injects as parameters for `notebook`
- `isReport`: If True, will hide inputs in notebook
- `poll`: Default is False, this will pool output every 15 seconds and displays, this is useful in cases where there's long running cells and user wants to see output after going to the page, since github actions doesn't show streaming from the beginning (but instead streams from the point user opens the page), this is a hack to get around it.

## Using secrets
`secretsPath` has secrets.
You can use it in notebook with something like
```
import os
import json
if secretsPath:
    with open(secretsPath, 'r') as secretsFile:
        secrets = json.loads(secretsFile.read())
        for (k, v) in secrets.items():
            os.environ[k] = v
   
```

Then, you can access secret simply by
```
print(os.environ["secretKeyName"])

```

# Contributing
## Creating tag
```
git checkout -b releases/v1
rm -rf node_modules
sed -i '/node_modules/d' .gitignore # Bash command that removes node_modules from .gitignore
sed -i 'lib' .gitignore # Bash command that removes lib from .gitignore
npm run build
git add node_modules .gitignore
git commit -am node_modules
git push origin releases/v2
git push origin :refs/tags/v2
git tag -fa v2 -m "Update v2 tag"
git push origin v2
```
## Updating tag
```
git checkout tags/v2 -b testtv1
npm run build
git commit -am "update"
git tag -fa v1 -m "Update v2 tag"
git push origin v2 --force
git push origin releases/v2
```

## Resources

See the walkthrough located [here](https://github.com/actions/toolkit/blob/master/docs/javascript-action.md) and versioning [here](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md).
