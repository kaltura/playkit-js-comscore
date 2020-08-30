import '../../src/index.js';
import {setup} from 'kaltura-player-js';
import * as TestUtils from './utils/test-utils';

const targetId = 'player-placeholder_js-comscore.spec';

describe('JsComscorePlugin', function () {
  let player;
  const config = {
    targetId,
    provider: {},
    sources: {
      progressive: [
        {
          mimetype: 'video/mp4',
          url:
            'https://cfvod.kaltura.com/pd/p/1726172/sp/172617200/serveFlavor/entryId/1_po3v31zx/v/1/ev/7/flavorId/1_67zt1djx/fileName/BBB_(Basic_Small_-_WEB_MBL_(H264_400)).mp4/name/a.mp4'
        }
      ]
    },
    plugins: {
      comscore: {}
    }
  };

  function createPlayerPlaceholder(targetId) {
    TestUtils.createElement('DIV', targetId);
    let el = document.getElementById(targetId);
    el.style.height = '360px';
    el.style.width = '640px';
  }

  function setupPlayer(config) {
    player = setup(config);
  }

  before(function () {
    createPlayerPlaceholder(targetId);
  });

  afterEach(function () {
    player.destroy();
    player = null;
    TestUtils.removeVideoElementsFromTestPage();
  });

  after(function () {
    TestUtils.removeElement(targetId);
  });

  it('should play mp4 stream with js-comscore plugin', done => {
    setupPlayer(config);
    player.addEventListener(player.Event.PLAYING, () => {
      done();
    });
    player.play();
  });
});
