#!/bin/bash
bold=$(tput bold)
standout=$(tput smso)
normal=$(tput sgr0)
green=$(tput setaf 2)
red=$(tput setaf 1)

abort() {
    echo
    echo
    printf '%*s\n' "${COLUMNS:-$(tput cols)}" '' | tr ' ' \#
    echo
    echo ${red}Operation failed${normal}
    echo
    echo
    exit 1
}

trap 'abort' 0
set -e

echo
if [ "$1" == "--debug" ]; then
    echo Compiling AlienTube in ${standout}debug${normal} mode.
else
    echo Compiling AlienTube in ${standout}production${normal} mode.
fi
printf '%*s\n' "${COLUMNS:-$(tput cols)}" '' | tr ' ' \#
echo

echo ${standout}Removing old files${normal}
echo Removing TypeScript mapping folders.
rm -rf Chrome/TypeScript
rm -rf Safari.safariextension/TypeScript
rm -rf Firefox/data/TypeScript

echo Removing TypeScript code-mapping file.
rm -f Chrome/js/script.js.map
rm -f Safari.safariextension/js/script.js.map
rm -f Firefox/data/script.js.map
rm -f lib/script.js.map
rm -f lib/script-es5.js.map

echo Removing options page TypeScript code-mapping file.
rm -f Chrome/js/options.js.map
rm -f Safari.safariextension/js/options.js.map
rm -f Firefox/data/options.js.map
rm -f lib/options.js.map
rm -f lib/options-es5.js.map

echo Removing SASS stylesheet code-mapping file.
rm -f Chrome/res/style.css.map
rm -f Safari.safariextension/res/style.css.map
rm -f Firefox/data/style.css.map
echo
echo

echo ${standout}Compiling SASS style files.${normal}
echo Compiling Main SASS stylesheet.
sass res/style.scss res/style.css
echo Compiling Options SASS stylesheet
sass res/options.scss res/options.css
echo
echo

echo ${standout}Copying static browser resources${normal}
echo Copying Chrome Resources
mkdir -p Chrome/res
mkdir -p Chrome/js
cp -fr res/redditbroken.svg Chrome/res
cp -fr res/redditoverload.svg Chrome/res
cp -fr res/redditblocked.svg Chrome/res
cp -fr res/icon128.png Chrome/res
cp -fr res/options.css Chrome/res
cp -fr lib/snuownd.js Chrome/js

echo Copying Safari Resources
mkdir -p Safari.safariextension/res
mkdir -p Safari.safariextension/js
cp -fr res/redditbroken.svg Safari.safariextension/res
cp -fr res/redditoverload.svg Safari.safariextension/res
cp -fr res/redditblocked.svg Safari.safariextension/res
cp -fr res/icon128.png Safari.safariextension/res
cp -fr res/options.css Safari.safariextension/res
cp -fr lib/snuownd.js Safari.safariextension/js
cp -fr lib/handlebars-v3.0.3.js Safari.safariextension/js

echo Copying Firefox Resources
mkdir -pv Firefox/data
cp -fr res/redditbroken.svg Firefox/data
cp -fr res/redditoverload.svg Firefox/data
cp -fr res/redditblocked.svg Firefox/data
cp -fr res/icon128.png Firefox/data
cp -fr res/options.css Firefox/data
cp -fr lib/snuownd.js Firefox/data
cp -fr lib/handlebars-v3.0.3.js Firefox/data
echo
echo

echo ${standout}Updating Options HTML Page${normal}
cp -vf  options.html Chrome/res/options.html
cp -vf options.html Firefox/data/options.html
cp -vf options.html Safari.safariextension/res/options.html
echo
echo


echo ${standout}Compiling TypeScript Files.${normal}
if [ "$1" == "--debug" ]; then
    echo Compiling Options page TypeScript in ES5 compatibility mode without comments with source map.
    tsc --target ES5 --out lib/options-es5.js TypeScript/Options/Options.ts --removeComments --sourcemap
    echo Compiling Application TypeScript in ES5 compatibility mode without comments with source map.
    tsc --target ES5 --out lib/script-es5.js TypeScript/index.ts --removeComments --sourcemap
    echo Compiling Background TypeScript in ES5 compatibility mode without comments with source map.
    tsc --target ES5 --out lib/background-es5.js TypeScript/background.ts --removeComments --sourcemap

    echo Compiling Options page TypeScript file without comments with source map.
    tsc --target ES6 --out lib/options.js TypeScript/Options/Options.ts --removeComments --sourcemap
    echo Compiling Application TypeScript file without comments with source map.
    tsc --target ES6 --out lib/script.js TypeScript/index.ts --removeComments --sourcemap
    echo Compiling Background TypeScript file without comments with source map.
    tsc --target ES6 --out lib/background.js TypeScript/background.ts --removeComments --sourcemap
else
    echo Compiling Options page TypeScript in ES5 compatibility mode with comments.
    tsc --target ES2015 --out lib/options-es5.js TypeScript/Options/Options.ts
    echo Compiling Application page TypeScript in ES5 compatibility mode with comments.
    tsc --target ES2015 --out lib/script-es5.js TypeScript/index.ts
    echo Compiling Background page TypeScript in ES5 compatibility mode with comments.
    tsc --target ES2015 --out lib/background-es5.js TypeScript/background.ts

    echo Compiling Options page TypeScript file with comments.
    tsc --target ES6 --out lib/options.js TypeScript/Options/Options.ts
    echo Compiling Application page TypeScript file with comments.
    tsc --target ES6 --out lib/script.js TypeScript/index.ts
    echo Compiling Background page TypeScript file with comments.
    tsc --target ES6 --out lib/background.js TypeScript/background.ts
fi
echo
echo Copying TypeScript Files
cp -vf lib/options-es5.js Chrome/res/options.js
cp -vf lib/options-es5.js Firefox/data/options.js
cp -vf lib/options-es5.js Safari.safariextension/res/options.js
cp -vf lib/script-es5.js Chrome/js/script.js
cp -vf lib/script-es5.js Safari.safariextension/js/script.js
cp -vf lib/script-es5.js Firefox/data/script.js
cp -vf lib/background-es5.js Chrome/js/background.js
echo
echo

echo ${standout}Copying Style Files${normal}
cp -vf res/style.css Chrome/res/style.css
cp -vf res/style.css Safari.safariextension/res/style.css
cp -vf res/style.css Firefox/data/style.css
echo

echo ${standout}Copying Template Files${normal}
cp -vf res/templates.html Chrome/res/templates.html
cp -vf res/templates.html Safari.safariextension/res/templates.html
cp -vf res/templates.html Firefox/data/templates.html
echo
echo

if [ "$1" == "--debug" ]; then
    echo ${standout}Copying Development Sourcemaps${normal}
    cp -vf lib/script.js.map Chrome/js/script.js.map
    cp -vf lib/options.js.map Chrome/js/options.js.map
    cp -vf lib/script-es5.js.map Safari.safariextension/js/script.js.map
    cp -vf lib/options-es5.js.map Safari.safariextension/js/options.js.map
    cp -vf lib/script.js.map Firefox/data/script.js.map
    cp -vf lib/options.js.map Firefox/data/options.js.map
    echo ""
    cp -vf res/style.css.map Chrome/res/style.css.map
    cp -vf res/style.css.map Safari.safariextension/res/style.css.map
    cp -vf res/style.css.map Firefox/data/style.css.map
    echo ""
    echo Copying TypeScript source folders.
    cp -fr TypeScript Chrome/
    cp -fr TypeScript Safari.safariextension/
    cp -fr TypeScript Firefox/data/TypeScript
    echo
    echo
fi

echo ${standout}Copying Localisation Files${normal}
echo Copying localisation files to Chrome
rsync -a --exclude=".*" _locales Chrome/
echo Copying localisation files to Safari
rsync -a --exclude=".*" _locales Safari.safariextension/
echo Copying localisation files to Firefox
rsync -a --exclude=".*" _locales Firefox/data/

if [ "$1" == "--debug" ] && [[ "$OSTYPE" == "darwin"* ]]; then
    echo ${standout}Reloading Development Browsers${normal}
    osascript reload.scpt
fi

echo
echo
printf '%*s\n' "${COLUMNS:-$(tput cols)}" '' | tr ' ' \#
echo
echo ${green}Operation completed sucessfully${normal}
echo
echo
trap : 0
