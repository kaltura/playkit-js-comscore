import '../../src/index.js';
import {loadPlayer} from 'playkit-js';
import * as TestUtils from 'playkit-js/test/src/utils/test-utils';

const targetId = 'player-placeholder_js-comscore.spec';

describe('JsComscorePlugin', function() {
  let player;
  const config = {
    sources: {
      progressive: [
        {
          mimetype: 'video/mp4',
          url: 'http://www.html5videoplayer.net/videos/toystory.mp4'
        }
      ]
    },
    plugins: {
      'js-comscore': {}
    }
  };

  function createPlayerPlaceholder(targetId) {
    TestUtils.createElement('DIV', targetId);
    let el = document.getElementById(targetId);
    el.style.height = '360px';
    el.style.width = '640px';
  }

  function setupPlayer(config) {
    player = loadPlayer(config);
    const el = document.getElementById(targetId);
    el.appendChild(player.getView());
  }

  before(function() {
    createPlayerPlaceholder(targetId);
  });

  afterEach(function() {
    player.destroy();
    player = null;
    TestUtils.removeVideoElementsFromTestPage();
  });

  after(function() {
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
