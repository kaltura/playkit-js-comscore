# PlayKit JS Comscore - Comscore Plugin for the [Kaltura Player JS]

[![Build Status](https://github.com/kaltura/playkit-js-comscore/actions/workflows/run_canary_full_flow.yaml/badge.svg)](https://github.com/kaltura/playkit-js-comscore/actions/workflows/run_canary_full_flow.yaml)
[![](https://img.shields.io/npm/v/@playkit-js/playkit-js-comscore/latest.svg)](https://www.npmjs.com/package/@playkit-js/playkit-js-comscore)
[![](https://img.shields.io/npm/v/@playkit-js/playkit-js-comscore/canary.svg)](https://www.npmjs.com/package/@playkit-js/playkit-js-comscore/v/canary)

PlayKit JS Comscore Engine integrates Comscore with the [PlayKit JS Player].

PlayKit JS Comscore is written in [ECMAScript6], statically analysed using [Flow] and transpiled in ECMAScript5 using [Babel].

[flow]: https://flow.org/
[ecmascript6]: https://github.com/ericdouglas/ES6-Learning#articles--tutorials
[babel]: https://babeljs.io

## Getting Started

### Prerequisites

The adapter requires [Kaltura Player JS] to be loaded first.

[Kaltura Player JS]: https://github.com/kaltura/kaltura-player-js

### Installing

First, clone and run [yarn] to install dependencies:

[yarn]: https://yarnpkg.com/lang/en/

```
git clone https://github.com/kaltura/playkit-js-comscore.git
cd playkit-js-comscore
yarn install
```

### Building

Then, build the player

```javascript
yarn run build
```

### Embed the library in your test page

Finally, add the bundle as a script tag in your page, and initialize the player

```html
<script type="text/javascript" src="/PATH/TO/FILE/kaltura-player.js"></script>
<script type="text/javascript" src="/PATH/TO/FILE/playkit-comscore.js"></script>
<div id="player-placeholder"" style="height:360px; width:640px">
<script type="text/javascript">
  var playerContainer = document.querySelector("#player-placeholder");
  var config = {...};
  var player = playkit.core.loadPlayer(config);
  playerContainer.appendChild(player.getView());
  player.play();
</script>
```

## Configuration

```javascript
{
  plugins: {
      comscore: {
        // comscore plugin configuration
      }
  }
}
```

## Running the tests

Tests can be run locally via [Karma], which will run on Chrome, Firefox and Safari

[karma]: https://karma-runner.github.io/1.0/index.html

```
yarn run test
```

You can test individual browsers:

```
yarn run test:chrome
yarn run test:firefox
yarn run test:safari
```

### And coding style tests

We use ESLint [recommended set](http://eslint.org/docs/rules/) with some additions for enforcing [Flow] types and other rules.

See [ESLint config](.eslintrc.json) for full configuration.

We also use [.editorconfig](.editorconfig) to maintain consistent coding styles and settings, please make sure you comply with the styling.

## Compatibility

TBD

## Contributing

Please read [CONTRIBUTING.md](https://gist.github.com/PurpleBooth/b24679402957c63ec426) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/kaltura/playkit-js-comscore/tags).

## License

This project is licensed under the AGPL-3.0 License - see the [LICENSE.md](LICENSE.md) file for details
