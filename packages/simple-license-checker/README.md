simple-license-checker
======================

Build tool to check that only permissive licenses are used
in an NPM package.

Usage
-----

```
$ npm install -g simple-license-checker
$ simple-license-checker
```

But recommended way is to include into an automatic build process:

```
{
  "devDependencies": {
    "simple-license-checker": "0.8.0"
  },
  "scripts": {
    "prepack": "simple-license-checker"
  }
}
```

Configuration
-------------

Additional licenses to allow can be passed on the command-line
via `--allow-licenses LICENSE LICENSE [...]`. Packages to allow
can be passed via `--allow-packages PACKAGE PACKAGE [...]`.

Both can also be passed in via `package.json` as:

```
{
  "simple-license-checker": {
    "allow-licenses": ["LICENSE"],
    "allow-packages": {
      "PACKAGE": "...REASON..."
    }
  }
}
```

