# Run notebook

This has been forked from [yaananth/run-notebook](https://www.github.com/yaananth/run-notebook).

## Usage

This github action runs a jupyter notebook, parameterizes it using [papermill](https://github.com/yaananth/papermill) and lets you upload produced output as artifact using [upload artifact action](https://github.com/marketplace/actions/upload-artifact)

**Note:** This action 

**Note**: This action produces output to a directory called `nb-runner` under runner's temp directory.


### Example 1 - executing notebook with parameters
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
    - uses: asegal/run-notebook@v1
      env:
        MY_ENV_VAR: "env var value"
        MY_SECRET_ENV_VAR: ${{ secrets.MY_SECRET_ENV_VAR }}
      with:
        temp_dir: "${{ runner.temp }}"
        workspace: "${{ github.workspace }}"
        notebooks: "*.ipynb"
        isReport: False
        poll: True
    # To attach the output as an artifact to workflow run
    - uses: actions/upload-artifact@master
      if: always()
      with:
        name: output
        path: ${{ RUNNER.temp }}/nb-runner
      env:
        RUNNER: ${{ toJson(runner) }}
    # Alternately, to commit the output to the repo
    - name: move to dir # Move the generated files into output folder
      run: |
        mkdir -p output
        cp -rf ${{ runner.temp }}/nb-runner/*.ipynb ./output/
    - name: Commit files 
      run: |
        git config --local user.email "arbitrary_email_address@arbitrary_domain.com"
        git config --local user.name "Notebook Runner"
        git add -f ./output
        git commit -m "Publishing updated notebooks"
    - name: Push changes 
      uses: ad-m/github-push-action@master
      with:
        branch: branch-name #ignore if your branch is master
        github_token: ${{ secrets.GITHUB_TOKEN }}
        force: false

```

## Parameters
- `temp_dir`: this is the working dir.  Best practice is to use an environment variable - it should be set to `${{ runner.temp }}`
- `workspace`: this is the github workspace. Best practice is to use an environment variable -  it should be set to `${{ github.workspace }}`
- `notebooks`: glob pattern for notebook files to process (implemented via [node-glob](https://github.com/isaacs/node-glob))
- `isReport`: If True, will hide inputs in notebook. *note* - github ignores the open/closed status of cells when presenting ipynb files.  This setting only makes a difference when opening the file in Jupyterlab.
- `poll`: Default is False, this will pool output every 15 seconds and displays, this is useful in cases where there's long running cells and user wants to see output after going to the page, since github actions doesn't show streaming from the beginning (but instead streams from the point user opens the page), this is a hack to get around it.

## env vars
All environment variables specified in the `env` block will be available in the notebook environment.  Any github secrets you wish to use in the notebook should be declared as env vars:
```
  env:
    MY_GITHUB_SECRET: ${{ secrets.MY_GITHUB_SECRET }}
```


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
