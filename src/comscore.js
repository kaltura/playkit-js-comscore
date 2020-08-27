// @flow
import {core, BasePlugin} from 'kaltura-player-js';
import ns_ from '../bin/streamsense.plugin.min.js';
const {MediaType, Utils, AdBreakType, Error, FakeEvent} = core;

declare var __VERSION__: string;

/**
 * Your class description.
 * @classdesc
 */
export default class Comscore extends BasePlugin {
  _trackEventMonitorCallbackName: string;
  _gPlugin: Object;
  _lastKnownPosition: number;
  _lastKnownAdPosition: number;
  _contentPartNumber: number;
  _isAd: boolean = false;
  _isLive: boolean = false;
  _adCachedAdvertisementMetadataObject: Object;
  _isAdPreroll: boolean;
  _adNumber: number;
  _adBreakNumber: number;
  _isPlaybackLifeCycleStarted: boolean;

  _gPluginPromise: ?DeferredPromise;

  static PLUGIN_PLATFORM_NAME = 'kalturav3';
  static PLUGIN_VERSION = __VERSION__;

  /**
   * @static
   * @override
   * @public
   * @returns {boolean} - Whether the plugin is valid.
   */
  static isValid(): boolean {
    return true;
  }

  /**
   * @constructor
   * @param {string} name - The plugin name.
   * @param {Player} player - The player instance.
   * @param {Object} config - The plugin config.
   */
  constructor(name: string, player: Player, config: any) {
    super(name, player, config);

    this._trackEventMonitorCallbackName = config.trackEventMonitor;

    this._init();
  }

  /**
   * Initializing the plugin.
   * @private
   * @returns {void}
   */
  _init(): void {
    this._gPlugin = null;
    this._lastKnownPosition = NaN;
    this._lastKnownAdPosition = NaN;
    this._contentPartNumber = 1;
    this._isAd = false;
    this._isLive = false;
    this._adCachedAdvertisementMetadataObject = null;
    this._isAdPreroll = false;
    this._gPluginPromise = null;
    this._isPlaybackLifeCycleStarted = false;
    this._adNumber = 0;
    this._adBreakNumber = 0;

    this._gPluginPromise = Utils.Object.defer();

    this.player.ready().then(() => {
      this.logger.debug('The comScore onReady event was triggered.');

      let pluginConfig = this._parsePluginConfig(this.config);

      this._trackEventMonitor('Configured publisherId', pluginConfig['publisherId']);

      this._gPlugin = new ns_.StreamingAnalytics.Plugin(
        pluginConfig,
        Comscore.PLUGIN_PLATFORM_NAME,
        Comscore.PLUGIN_VERSION,
        this.config.playerVersion,
        {
          position: this._getCurrentPosition.bind(this)
        }
      );

      this._setInitialPlayerData();

      if (this._gPluginPromise) {
        this._gPluginPromise.resolve();
      }
    });

    this._addBindings();
  }

  _getCurrentPosition(): number {
    if (this._isAd) {
      return this._lastKnownAdPosition;
    }

    if (this._isLive) {
      return NaN;
    }

    let reportedPosition = this.player.currentTime;
    return Math.floor(reportedPosition * 1000);
  }

  _addBindings(): void {
    let listeners = {
      [this.player.Event.SOURCE_SELECTED]: this._onSourceSelected,
      [this.player.Event.ERROR]: this._onError,
      [this.player.Event.SEEKING]: this._onSeeking,
      [this.player.Event.PAUSE]: this._onPause,
      [this.player.Event.ENDED]: this._onEnded,
      [this.player.Event.TIME_UPDATE]: this._onTimeUpdate,
      [this.player.Event.RATE_CHANGE]: this._onRateChange,
      [this.player.Event.PLAYER_STATE_CHANGED]: this._onPlayerStateChanged,
      [this.player.Event.VIDEO_TRACK_CHANGED]: this._onVideoTrackChanged,
      [this.player.Event.AUDIO_TRACK_CHANGED]: this._onAudioTrackChanged,
      [this.player.Event.TEXT_TRACK_CHANGED]: this._onTextTrackChanged,
      [this.player.Event.ENTER_FULLSCREEN]: this._onEnterFullscreen,
      [this.player.Event.EXIT_FULLSCREEN]: this._onExitFullScreen,
      [this.player.Event.VOLUME_CHANGE]: this._onVolumeChange,
      [this.player.Event.AD_LOADED]: this._onAdLoaded,
      [this.player.Event.AD_STARTED]: this._onAdStarted,
      [this.player.Event.AD_RESUMED]: this._onAdResumed,
      [this.player.Event.AD_PAUSED]: this._onAdPaused,
      [this.player.Event.AD_CLICKED]: this._onAdClicked,
      [this.player.Event.AD_SKIPPED]: this._onAdSkipped,
      [this.player.Event.AD_COMPLETED]: this._onAdCompleted,
      [this.player.Event.AD_ERROR]: this._onAdError,
      [this.player.Event.ALL_ADS_COMPLETED]: this._onAllAdsCompleted,
      [this.player.Event.AD_BREAK_START]: this._onAdBreakStart,
      [this.player.Event.AD_BREAK_END]: this._onAdBreakEnd,
      [this.player.Event.AD_PROGRESS]: this._onAdProgress
    };

    Object.keys(listeners).forEach((eventName: string) => {
      const listener = listeners[eventName];
      this.eventManager.listen(this.player, eventName, event => {
        this._gPluginPromise &&
          this._gPluginPromise.then(() => {
            if (eventName !== this.player.Event.TIME_UPDATE) {
              this.logger.debug('comScore plugin:', 'Event:', eventName, event);
            }
            if (typeof listener === 'function') {
              listener.call(this, event);
            }
          });
      });
    });
  }

  _onError(event: Object): void {
    let fatal = false;

    if (event.payload && event.payload.severity === Error.Severity.CRITICAL) fatal = true;

    // Sometimes we've observed the payload object does not exist.
    let code = (event.payload && event.payload.code) || null;

    if (fatal && this._isPlaybackLifeCycleStarted) {
      this._sendCommand('notifyEnd', this._getCurrentPosition(), {
        ns_st_er: code
      });
    } else {
      this._sendCommand('notifyError', this._getCurrentPosition(), {
        ns_st_er: code
      });
    }
  }

  _onAdLoaded(event: FakeEvent): void {
    this._adCachedAdvertisementMetadataObject = event.payload;
  }

  _onAdBreakStart(event: FakeEvent): void {
    this._isAd = true;
    this._adNumber = 0;

    const adBreakType = event.payload.adBreak.type;
    if (adBreakType === AdBreakType.PRE || adBreakType === AdBreakType.POST) {
      this._adBreakNumber = 1;
    } else {
      this._adBreakNumber++;
    }
  }

  _onAdStarted(): void {
    // This should never happen.
    if (!this._adCachedAdvertisementMetadataObject || !this._isAd) return;

    // Based on what we've played, we will increase the part number at the end of the ad break.
    this._isAdPreroll = this.player.ads.getAdBreak().type === AdBreakType.PRE;

    this._adNumber++;

    this._gPlugin.setAsset(
      this._getAdvertisementMetadataLabels(this._adCachedAdvertisementMetadataObject, this.player.config),
      false,
      this._getContentMetadataObjects()
    );

    this._sendCommand('notifyPlay', 0);

    this._isPlaybackLifeCycleStarted = true;
  }

  _onAdResumed(): void {
    this._sendCommand('notifyPlay');

    this._isPlaybackLifeCycleStarted = true;
  }

  _onAdPaused(): void {
    this._sendCommand('notifyPause');

    this._isPlaybackLifeCycleStarted = true;
  }

  _onAdClicked(): void {}

  _onAdSkipped(): void {
    this._sendCommand('notifySkipAd');

    this._isPlaybackLifeCycleStarted = true;
  }

  _onAdCompleted(): void {
    if (this._adCachedAdvertisementMetadataObject.ad && this._adCachedAdvertisementMetadataObject.ad.duration) {
      let duration = Math.floor(this._adCachedAdvertisementMetadataObject.ad.duration * 1000);
      this._sendCommand('notifyEnd', duration);
    } else {
      this._sendCommand('notifyEnd');
    }

    this._lastKnownAdPosition = NaN;
    this._isPlaybackLifeCycleStarted = false;
  }

  _onAdError(): void {
    // TODO
  }

  _onAllAdsCompleted(): void {
    this._onAdBreakEnd();
  }

  _onAdBreakEnd(): void {
    if (!this._isAd) return;

    this._isAd = false;

    if (!this._isAdPreroll) {
      this._contentPartNumber++;
    }

    // We've finished with the ad break, moving back to content asset.
    this._gPlugin.setAsset(this._getContentMetadataLabels(this.player.config), false, this._getContentMetadataObjects());
  }

  _onAdProgress(event: FakeEvent): void {
    this._lastKnownAdPosition = Math.floor(event.payload.adProgress.currentTime);
  }

  _onPlayerStateChanged(event: FakeEvent): void {
    const oldState = event.payload.oldState;
    const newState = event.payload.newState;

    if (oldState.type === this.player.State.BUFFERING) {
      this._sendCommand('notifyBufferStop');
      this._isPlaybackLifeCycleStarted = true;
    }

    if (newState.type === this.player.State.BUFFERING) {
      this._sendCommand('notifyBufferStart');
      this._isPlaybackLifeCycleStarted = true;
    }

    if (newState.type === this.player.State.PLAYING) {
      this._onPlaying();
    }
  }

  /**
   * If seeking, a midroll may appear and if so a few ms of playback may also occur.
   * Our tag will notify that playback.
   * @returns {void}
   * */
  _onSeeking(): void {
    if (this._isLive) {
      this._sendCommand('notifySeekStart');

      let dvrWindowLength = Math.floor(this.player.duration * 1000);
      let dvrWindowOffsetPosition = Math.floor(dvrWindowLength - Math.floor(this.player.currentTime * 1000));

      this._gPlugin.setDvrWindowOffset(dvrWindowOffsetPosition);
      this._gPlugin.setDvrWindowLength(dvrWindowLength);
    } else {
      this._sendCommand('notifySeekStart', this._lastKnownPosition);
    }

    this._isPlaybackLifeCycleStarted = true;
  }

  _onPlaying(): void {
    this._sendCommand('notifyPlay');

    this._isPlaybackLifeCycleStarted = true;
  }

  _onEnded(): void {
    this._sendCommand('notifyEnd');

    this._isPlaybackLifeCycleStarted = false;
  }

  _onPause(): void {
    // When playing content and an Ad is about to be played, a Pause event is triggered.
    if (this._isAd) return;

    // At the end of the playback we've notice there's an unexpected pause event.
    // We won't notify this pause, only these happening at the middle of the playback.
    // This should not apply on live streams.
    if (this._isLive || Math.ceil(this.player.currentTime) < this.player.duration) {
      this._sendCommand('notifyPause');

      this._isPlaybackLifeCycleStarted = true;
    }
  }

  _onTimeUpdate(): void {
    if (this._isLive) {
      let dvrWindowLength = Math.floor(this.player.duration * 1000);
      let dvrWindowOffsetPosition = Math.max(dvrWindowLength - Math.floor(this.player.currentTime * 1000), 0);

      this._gPlugin.setDvrWindowOffset(dvrWindowOffsetPosition);
      this._gPlugin.setDvrWindowLength(dvrWindowLength);

      return;
    }

    this._lastKnownPosition = this._getCurrentPosition();
  }

  _onRateChange(): void {
    const playbackRate = this.player.playbackRate * 100;

    this._gPlugin.notifyChangePlaybackRate(playbackRate);
  }

  _onVideoTrackChanged(event: FakeEvent): void {
    if (!event.payload || !event.payload.selectedVideoTrack) return;

    let bandwidth = event.payload.selectedVideoTrack._bandwidth;

    this.logger.debug('comScore notification: notifyChangeBitrate with', bandwidth);
    this._trackEventMonitor('notifyChangeBitrate with', bandwidth);

    this._gPlugin.notifyChangeBitrate(bandwidth);
  }

  _onAudioTrackChanged(event: FakeEvent): void {
    if (!event.payload || !event.payload.selectedAudioTrack) return;

    let trackName = event.payload.selectedAudioTrack._language;

    this.logger.debug('comScore notification: notifyChangeAudioTrack with', trackName);
    this._trackEventMonitor('notifyChangeAudioTrack with', trackName);

    this._gPlugin.notifyChangeAudioTrack(trackName);
  }

  _onTextTrackChanged(event: FakeEvent): void {
    if (!event.payload || !event.payload.selectedTextTrack) return;

    let trackName = event.payload.selectedTextTrack._language;

    this.logger.debug('comScore notification: notifyChangeSubtitleTrack with', trackName);
    this._trackEventMonitor('notifyChangeSubtitleTrack with', trackName);

    this._gPlugin.notifyChangeSubtitleTrack(trackName);
  }

  _onEnterFullscreen(): void {
    this._updateWindowState();
  }

  _onExitFullScreen(): void {
    this._updateWindowState();
  }

  _onVolumeChange(): void {
    this._updatePlayerVolume();
  }

  _onSourceSelected(): void {
    this._isLive = this.player.isLive();

    this._gPlugin.createPlaybackSession();
    this._gPlugin.setAsset(this._getContentMetadataLabels(this.player.config), false, this._getContentMetadataObjects());

    if (this._isLive) {
      this._gPlugin.setDvrWindowLength(Math.floor(this.player.duration * 1000));
    }
  }

  _updateWindowState(): void {
    let windowState = this.player.isFullscreen() ? 'full' : 'norm';

    this.logger.debug('comScore notification: notifyChangeWindowState with:', windowState);
    this._trackEventMonitor('notifyChangeWindowState with:', windowState);

    this._gPlugin.notifyChangeWindowState(windowState);
  }

  _updatePlayerVolume(): void {
    let newPlayerVolume = this.player.muted ? 0 : Math.floor(this.player.volume * 100);

    this.logger.debug('comScore change notification: notifyChangeVolume with', newPlayerVolume);
    this._trackEventMonitor('notifyChangeVolume with', newPlayerVolume);

    this._gPlugin.notifyChangeVolume(newPlayerVolume);
  }

  _setInitialPlayerData(): void {
    this._updatePlayerVolume();
    this._updateWindowState();
  }

  _sendCommand(notifyCommandName: string, position?: number, labels?: Object): void {
    this.logger.debug('comScore notification:', notifyCommandName, 'with position:', position, 'with event labels:', labels);
    this._trackEventMonitor(notifyCommandName, 'with position:', position == null ? 'no-position' : position, 'with event labels:', labels);

    try {
      this._gPlugin[notifyCommandName](position, labels);
    } catch (e) {
      this.logger.error('Error occur while trying to send:' + notifyCommandName + ' to comscore', e);
    }
  }

  /**
   * Destroys the plugin.
   * @override
   * @public
   * @returns {void}
   */
  destroy(): void {
    this.logger.debug('comScore plugin is being destroyed');

    this.eventManager.destroy();

    if (this._gPlugin) {
      this._gPlugin.release();
      this._gPlugin = null;
    }
  }

  /**
   * Resets the plugin.
   * @override
   * @public
   * @returns {void}
   */
  reset(): void {
    this.logger.debug('comScore plugin is being reset');

    if (this._gPlugin) {
      this._gPlugin.release();
      this._gPlugin = null;
    }

    this._init();
  }

  _getAdvertisementMetadataLabels(advertisementMetadataObject: Object, relatedContentMetadataObject: Object): Object {
    const advertisementMetadataLabels = {};
    const contentMetadataLabels = this._getContentMetadataLabels(relatedContentMetadataObject);

    const isLive = this.player.isLive(),
      isAudio = this.player.config.sources.type === MediaType.AUDIO;

    const labelsToCopyFromContentMetadata = ['ns_st_ci', 'ns_st_pl', 'ns_st_pr', 'ns_st_ep'];

    for (const labelName of labelsToCopyFromContentMetadata) {
      if (labelName in contentMetadataLabels) {
        advertisementMetadataLabels[labelName] = contentMetadataLabels[labelName];
      }
    }

    advertisementMetadataLabels['ns_st_pn'] = '1'; // Current part number of the ad. Always assume part 1.
    advertisementMetadataLabels['ns_st_tp'] = '1'; // Always assume ads have a total // Playlist title. of 1 parts.

    if (advertisementMetadataObject.ad && advertisementMetadataObject.ad.duration) {
      advertisementMetadataLabels['ns_st_cl'] = Math.floor(advertisementMetadataObject.ad.duration * 1000);
    }

    advertisementMetadataLabels['ns_st_an'] = this._adNumber + '';
    advertisementMetadataLabels['ns_st_bn'] = this._adBreakNumber + '';
    advertisementMetadataLabels['ns_st_cs'] = '0x0';
    advertisementMetadataLabels['ns_st_ty'] = isAudio ? 'audio' : 'video';

    if (isLive) {
      advertisementMetadataLabels['ns_st_li'] = '1';
    }

    const contentTypeSuffix = isAudio ? 'aa' : 'va';
    const adBreakType = this.player.ads.getAdBreak().type;
    if (adBreakType === AdBreakType.PRE) {
      advertisementMetadataLabels['ns_st_ad'] = 'pre-roll';
      advertisementMetadataLabels['ns_st_ct'] = contentTypeSuffix + (isLive ? '21' : '11');
    } else if (adBreakType === AdBreakType.POST) {
      advertisementMetadataLabels['ns_st_ad'] = 'post-roll';
      advertisementMetadataLabels['ns_st_ct'] = contentTypeSuffix + (isLive ? '21' : '13');
    } else if (adBreakType === AdBreakType.MID) {
      advertisementMetadataLabels['ns_st_ad'] = 'mid-roll';
      advertisementMetadataLabels['ns_st_ct'] = contentTypeSuffix + (isLive ? '21' : '12');
    } else {
      // This should never happen.
      advertisementMetadataLabels['ns_st_ad'] = 1;
    }

    if (advertisementMetadataObject.ad) {
      if (advertisementMetadataObject.ad.id) {
        advertisementMetadataLabels['ns_st_ami'] = advertisementMetadataObject.ad.id;
      }
      if (advertisementMetadataObject.ad.title) {
        advertisementMetadataLabels['ns_st_amt'] = advertisementMetadataObject.ad.title;
      }
      if (advertisementMetadataObject.ad.system) {
        advertisementMetadataLabels['ns_st_amt'] = advertisementMetadataObject.ad.system;
      }
    }

    return advertisementMetadataLabels;
  }

  _getContentMetadataLabels(contentMetadataObject: Object): Object {
    let contentMetadataLabels = {};

    if (this.player.isLive()) {
      contentMetadataLabels['ns_st_li'] = '1';
    }

    if (this.player.config.sources.type === MediaType.AUDIO) {
      contentMetadataLabels['ns_st_ct'] = 'ac00';
      contentMetadataLabels['ns_st_ty'] = 'audio';
    } else {
      contentMetadataLabels['ns_st_ct'] = 'vc00';
      contentMetadataLabels['ns_st_ty'] = 'video';
    }

    contentMetadataLabels['ns_st_pl'] = contentMetadataObject.sources.metadata.name;
    contentMetadataLabels['ns_st_pr'] = contentMetadataObject.sources.metadata.name;
    contentMetadataLabels['ns_st_ep'] = contentMetadataObject.sources.metadata.name;
    contentMetadataLabels['ns_st_cl'] = Math.floor(contentMetadataObject.sources.duration * 1000);
    contentMetadataLabels['ns_st_ci'] = contentMetadataObject.sources.id;
    contentMetadataLabels['ns_st_pn'] = this._contentPartNumber + '';
    contentMetadataLabels['ns_st_tp'] = '0';
    contentMetadataLabels['ns_st_cs'] = '0x0';

    if (this.player.src) {
      contentMetadataLabels['ns_st_cu'] = this.player.src;
    }

    return contentMetadataLabels;
  }

  _getContentMetadataObjects(): Object {
    let contentMetadataObject = [];

    if (this._isAd) {
      contentMetadataObject.push({
        prefix: '',
        map: this._adCachedAdvertisementMetadataObject.ad
      });
    } else {
      contentMetadataObject.push({
        prefix: '',
        map: this.player.config.sources.metadata
      });
    }

    contentMetadataObject.push({
      prefix: 'content',
      map: this.player.config.sources.metadata
    });
    contentMetadataObject.push({
      prefix: 'content.clip',
      map: this.player.config.sources
    });
    contentMetadataObject.push({
      prefix: 'content.clip.session',
      map: this.player.config.session
    });
    contentMetadataObject.push({
      prefix: 'content.clip.playback',
      map: this.player.config.playback
    });

    return contentMetadataObject;
  }

  /**
   * Prepares the object to be consumed by the comScore Generic Plugin Library.
   * @private
   * @param {object} pluginConfig - Plugin configuration object.
   * @returns {object} The object to be consumed by the comScore Generic Plugin library.
   * */
  _parsePluginConfig(pluginConfig: Object): Object {
    const comScorePluginSettings = Object.assign({}, pluginConfig);

    return comScorePluginSettings;
  }

  _trackEventMonitor(...args: Array<any>): void {
    if (typeof window[this._trackEventMonitorCallbackName] !== 'function') return;

    args.unshift('comScore');

    window[this._trackEventMonitorCallbackName](args);
  }
}
