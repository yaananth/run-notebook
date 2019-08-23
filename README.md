# Run notebook
## Usage

Note: This action produces output to a directory called `nb-runner` under runner's temp directory.

```
name: Execute notebook

on: [push]

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v1
    - name: Set up Python
      uses: actions/setup-python@v1
    - uses: yaananth/run-notebook@v1
      env:
        RUNNER: ${{ toJson(runner) }}
        SECRETS: ${{ toJson(secrets) }}
      with:
        notebook: "PATHTONOTEBOOK.ipynb"
        params: "PATHTOPARAMS.json"
    - uses: actions/upload-artifact@master
      with:
        name: output
        path: ${{ RUNNER.temp }}/nb-runner
      env:
        RUNNER: ${{ toJson(runner) }}

```

This github action runs a jupyter notebook, parameterizes it using [papermill](https://github.com/nteract/papermill) and lets you upload produced output as artifact using [upload artifact action](https://github.com/marketplace/actions/upload-artifact)

# Contributing
## Creating tag
```
git checkout -b releases/v1
rm -rf node_modules
sed -i '/node_modules/d' .gitignore # Bash command that removes node_modules from .gitignore
sed -i 'lib' .gitignore # Bash command that removes lib from .gitignore
git add node_modules .gitignore
git commit -am node_modules
git push origin releases/v1
git push origin :refs/tags/v1
git tag -fa v1 -m "Update v1 tag"
git push origin v1
```
## Updating tag
```
git checkout tags/v1 -b testtv1
npm run build
git commit -am "update"
git tag -fa v1 -m "Update v1 tag"
git push origin v1 --force
```

## Resources

See the walkthrough located [here](https://github.com/actions/toolkit/blob/master/docs/javascript-action.md) and versioning [here](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md).
