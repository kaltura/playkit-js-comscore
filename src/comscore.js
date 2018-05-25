// @flow
import {BasePlugin, MediaType, Utils, FakeEvent, Error} from 'playkit-js'
import ns_ from "../bin/streamsense.plugin.min.js"

/**
 * Your class description.
 * @classdesc
 */
export default class Comscore extends BasePlugin {
  _gPlugin: Object;
  _lastKnownPosition: Number;
  _lastKnownAdPosition: Number;
  _contentPartNumber: Number;
  _isAd: boolean = false;
  _isLive: boolean = false;
  _adCachedAdvertisementMetadataObject: Object;
  _isAdPreroll: boolean;
  _adNumber: Number;
  _adBreakNumber: Number;
  _isPlaybackLifeCycleStarted: boolean;
  _continuousPlaybackSession: boolean;

  _gPluginPromise: Promise<*>;

  static PLUGIN_VERSION = "2.0.0";
  static PLUGIN_PLATFORM_NAME = "kalturav3";
  static PLUGIN_COMSCORE_PLUGIN_EVENT = "CS_COMSCORE_STA";

  // Settings
  static SETTING_CONTINUOUS_PLAYBACK_SESSION = "continuousPlaybackSession";

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
  constructor(name: string, player: Player, config: Object) {
    super(name, player, config);

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
      this.logger.debug("The comScore onReady event was triggered.");

      let pluginConfig = this._parsePluginConfig(this.config);

      this._logApiCall('StreamingAnalytics Generic Plugin', {
        config: pluginConfig,
        platform_name: Comscore.PLUGIN_PLATFORM_NAME,
        plugin_version: Comscore.PLUGIN_VERSION,
        player_version: window.KalturaPlayer.VERSION
      });

      this._gPlugin = new ns_.StreamingAnalytics.Plugin(pluginConfig, Comscore.PLUGIN_PLATFORM_NAME, Comscore.PLUGIN_VERSION, window.KalturaPlayer.VERSION, {
        position: this._getCurrentPosition.bind(this)
      });

      this._setInitialPlayerData();

      this._gPluginPromise.resolve();
    });

    this._addBindings();
  }

  _getCurrentPosition(): void {
    if(this._isAd) {
      return this._lastKnownAdPosition;
    }

    if(this._isLive) {
      return NaN;
    }

    let reportedPosition = this.player.currentTime;
    return Math.floor(reportedPosition * 1000);
  }

  _addBindings(): void {
    let listeners = {
      [this.player.Event.SOURCE_SELECTED]: this._onSourceSelected,
      [this.player.Event.ERROR]: this._onError,
      [this.player.Event.PLAYING]: this._onPlaying,
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
      [this.player.Event.AD_PROGRESS]: this._onAdProgress,
    };

    for (const [eventName, listener] of Object.entries(listeners)) {
      this.eventManager.listen(this.player, eventName, (event) => {
        this._gPluginPromise.then(() => {
          this.logger.debug("comScore Plugin event:", eventName, event);

          listener.call(this, event);
        });
      });
    }
  }

  _onError(event): void {
    let fatal = false;

    if(event.payload && event.payload.severity === Error.Severity.CRITICAL)
      fatal = true;

    // Somtimes we've observed the payload object does not exist.
    let code = event.payload && event.payload.code || null;

    if(fatal && this._isPlaybackLifeCycleStarted) {
      this._sendCommand('notifyEnd', this._getCurrentPosition(), {
        'ns_st_er': code
      });
    } else {
      this._sendCommand('notifyError', this._getCurrentPosition(), {
        'ns_st_er': code
      });
    }
  }

  _onAdLoaded(event): void {
    this._adCachedAdvertisementMetadataObject = event.payload;
  }

  _onAdBreakStart(): void {
    this._isAd = true;
    this._adNumber = 0;

    if(this._adCachedAdvertisementMetadataObject.adType == 'preroll' || this._adCachedAdvertisementMetadataObject.adType == 'postroll') {
      this._adBreakNumber = 1;
    } else {
      this._adBreakNumber++;
    }
  }
  _onAdStarted(): void {
    // This should never happen.
    if(!this._adCachedAdvertisementMetadataObject || !this._isAd) return;

    // Based on what we've played, we will increase the part number at the end of the ad break.
    this._isAdPreroll = this._adCachedAdvertisementMetadataObject.adType == 'preroll';

    this._adNumber++;

    this._gPlugin.setAsset(this._getAdvertisementMetadataLabels(this._adCachedAdvertisementMetadataObject, this.player.config), false, this._getContentMetadataObjects());

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
  _onAdClicked(): void {
  }
  _onAdSkipped(): void {
    this._sendCommand('notifySkipAd');

    this._isPlaybackLifeCycleStarted = true;
  }
  _onAdCompleted(): void {
    if(this._adCachedAdvertisementMetadataObject.extraAdData && this._adCachedAdvertisementMetadataObject.extraAdData.duration) {
      let duration = Math.floor(this._adCachedAdvertisementMetadataObject.extraAdData.duration * 1000);
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
    if(!this._isAd) return;

    this._isAd = false;

    if(!this._isAdPreroll) {
      this._contentPartNumber++;
    }

    // We've finished with the ad break, moving back to content asset.
    this._gPlugin.setAsset(this._getContentMetadataLabels(this.player.config), false, this._getContentMetadataObjects());
  }
  _onAdProgress(event): void {
    this._lastKnownAdPosition = Math.floor(event.payload.adProgress.currentTime);
  }

  _onPlayerStateChanged(event): void {
    const oldState = event.payload.oldState;
    const newState = event.payload.newState;

    if (oldState.type === this.player.State.BUFFERING) {
      this._sendCommand("notifyBufferStop");
      this._isPlaybackLifeCycleStarted = true;
    }

    if (newState.type === this.player.State.BUFFERING) {
      this._sendCommand("notifyBufferStart");
      this._isPlaybackLifeCycleStarted = true;
    }
  }

  /**
   * If seeking, a midroll may appear and if so a few ms of playback may also occur.
   * Our tag will notify that playback.
   * @returns {void}
   * */
  _onSeeking(): void {
    if(this._isLive) {
      this._sendCommand("notifySeekStart");

      let dvrWindowLength = Math.floor(this.player.duration * 1000);
      let dvrWindowOffsetPosition = Math.floor(dvrWindowLength - Math.floor(this.player.currentTime * 1000), 0);

      this._gPlugin.setDvrWindowOffset(dvrWindowOffsetPosition);
      this._gPlugin.setDvrWindowLength(dvrWindowLength);
    } else {
      this._sendCommand("notifySeekStart", this._lastKnownPosition);
    }

    this._isPlaybackLifeCycleStarted = true;
  }

  _onPlaying(): void{
    this._sendCommand("notifyPlay");

    this._isPlaybackLifeCycleStarted = true;
  }

  _onEnded(): void {
    this._sendCommand("notifyEnd");

    this._isPlaybackLifeCycleStarted = false;
  }

  _onPause(): void {
    // When playing content and an Ad is about to be played, a Pause event is triggered.
    if(this._isAd) return;

    // At the end of the playback we've notice there's an unexpected pause event.
    // We won't notify this pause, only these happening at the middle of the playback.
    // This should not apply on live streams.
    if(this._isLive || Math.ceil(this.player.currentTime) < this.player.duration) {
      this._sendCommand("notifyPause");

      this._isPlaybackLifeCycleStarted = true;
    }
  }

  _onTimeUpdate(): void {
    if(this._isLive) {
      let dvrWindowLength = Math.floor(this.player.duration * 1000);
      let dvrWindowOffsetPosition = Math.max(dvrWindowLength - Math.floor(this.player.currentTime * 1000), 0);

      this._logApiCall('setDvrWindowOffset', dvrWindowOffsetPosition);
      this._logApiCall('setDvrWindowLength', dvrWindowLength);

      this._gPlugin.setDvrWindowOffset(dvrWindowOffsetPosition);
      this._gPlugin.setDvrWindowLength(dvrWindowLength);

      return;
    }

    this._lastKnownPosition = this._getCurrentPosition();
  }

  _onRateChange(): void {
    const playbackRate = this.player.playbackRate;

    this._logApiCall('notifyChangePlaybackRate', playbackRate);

    this._gPlugin.notifyChangePlaybackRate(playbackRate);
  }

  _onVideoTrackChanged(event): void {
    if(!event.payload || !event.payload.selectedVideoTrack) return;

    let bandwidth = event.payload.selectedVideoTrack._bandwidth;

    this._logApiCall('notifyChangeAudioTrack', bandwidth);

    this._gPlugin.notifyChangeBitrate(bandwidth);
  }

  _onAudioTrackChanged(event): void {
    if(!event.payload || !event.payload.selectedAudioTrack) return;

    let trackName = event.payload.selectedAudioTrack._language;

    this._logApiCall('notifyChangeAudioTrack', trackName);

    this._gPlugin.notifyChangeAudioTrack(trackName);
  }

  _onTextTrackChanged(event): void {
    if(!event.payload || !event.payload.selectedTextTrack) return;

    let trackName = event.payload.selectedTextTrack._language;

    this._logApiCall('notifyChangeSubtitleTrack', trackName);

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
    if(!this._continuousPlaybackSession) {
      this._gPlugin.createPlaybackSession();
    }

    this._isLive = this.player.isLive();

    this._gPlugin.setAsset(this._getContentMetadataLabels(this.player.config), false, this._getContentMetadataObjects());

    if(this._isLive) {
      this._gPlugin.setDvrWindowLength(Math.floor(this.player.duration * 1000));
    }
  }

  _updateWindowState(): void {
    let windowState = this.player.isFullscreen() ? 'full' : 'norm';

    this._logApiCall('notifyChangeWindowState', windowState);

    this._gPlugin.notifyChangeWindowState( windowState );
  }

  _updatePlayerVolume(): void {
    let newPlayerVolume = this.player.muted ? 0 : Math.floor( this.player.volume * 100 );

    this._logApiCall('notifyChangeVolume', newPlayerVolume);

    this._gPlugin.notifyChangeVolume(newPlayerVolume);
  }

  _setInitialPlayerData(): void {
    this._updatePlayerVolume();
    this._updateWindowState();
  }

  _sendCommand(notifyCommandName: string, position: Number, labels: object): void {
    this._logApiCall(notifyCommandName, {
      position: position,
      labels: labels
    });

    try {
      this._gPlugin[notifyCommandName](position, labels);
    } catch(e){
      this.logger.error("Error occur while trying to send:" + notifyCommandName +" to comscore",e);
    }
  }

  /**
   * Destroys the plugin.
   * @override
   * @public
   * @returns {void}
   */
  destroy(): void {
    this.logger.debug("comScore plugin is being destroyed");

    this.eventManager.destroy();

    if(this._gPlugin){
      this._gPlugin.release();
      this._gPlugin = null;
    }
  }

  /**
   * Resets the plugin. It will be executed:
   * 1. loadMedia is called. E.g. media change
   * 2. when the reset API method is called - it stops the current playback and should basically unload the current session.
   *
   * Because we are not able to distinguish between the 1st from the 2nd
   * this plugin method will only handle the 1st scenario, ignoring the 2nd.
   *
   * @override
   * @public
   * @returns {void}
   */
  reset(): void {
    this.logger.debug("comScore plugin is ignoring the reset.");
  }

  _getAdvertisementMetadataLabels(advertisementMetadataObject, relatedContentMetadataObject): Object {
    const advertisementMetadataLabels = {};
    const contentMetadataLabels = this._getContentMetadataLabels(relatedContentMetadataObject);

    const isLive = this.player.isLive(),
      isAudio = this.player.config.sources.type == MediaType.AUDIO;

    const labelsToCopyFromContentMetadata = [
      'ns_st_ci',
      'ns_st_pl',
      'ns_st_pr',
      'ns_st_ep'
    ];

    for(const labelName of labelsToCopyFromContentMetadata) {
      if(labelName in contentMetadataLabels) {
        advertisementMetadataLabels[labelName] = contentMetadataLabels[labelName];
      }
    }

    advertisementMetadataLabels['ns_st_pn'] = "1"; // Current part number of the ad. Always assume part 1.
    advertisementMetadataLabels['ns_st_tp'] = "1"; // Always assume ads have a total // Playlist title. of 1 parts.

    if(advertisementMetadataObject.extraAdData && advertisementMetadataObject.extraAdData.duration) {
      advertisementMetadataLabels['ns_st_cl'] = Math.floor(advertisementMetadataObject.extraAdData.duration * 1000);
    }

    advertisementMetadataLabels['ns_st_an'] = this._adNumber + "";
    advertisementMetadataLabels['ns_st_bn'] = this._adBreakNumber + "";
    advertisementMetadataLabels['ns_st_cs'] = "0x0";
    advertisementMetadataLabels['ns_st_ty'] = isAudio ? 'audio' : 'video';


    if (isLive) {
      advertisementMetadataLabels['ns_st_li'] = "1";
    }

    const contentTypeSuffix = isAudio ? 'aa' : 'va';
    if (advertisementMetadataObject.adType == 'preroll') {
      advertisementMetadataLabels['ns_st_ad'] = "pre-roll";
      advertisementMetadataLabels['ns_st_ct'] = contentTypeSuffix + (isLive ? '21' : '11');
    } else if (advertisementMetadataObject.adType == 'postroll') {
      advertisementMetadataLabels['ns_st_ad'] = "post-roll";
      advertisementMetadataLabels['ns_st_ct'] = contentTypeSuffix + (isLive ? '21' : '13');
    } else if (advertisementMetadataObject.adType == 'midroll') {
      advertisementMetadataLabels['ns_st_ad'] = "mid-roll";
      advertisementMetadataLabels['ns_st_ct'] = contentTypeSuffix + (isLive ? '21' : '12');
    } else {
      // This should never happen.
      advertisementMetadataLabels['ns_st_ad'] = 1;
    }

    if(advertisementMetadataObject.extraAdData && advertisementMetadataObject.extraAdData.adId) {
      advertisementMetadataLabels['ns_st_ami'] = advertisementMetadataObject.extraAdData.adId + '';
    }

    if(advertisementMetadataObject.extraAdData && advertisementMetadataObject.extraAdData.adSystem) {
      advertisementMetadataLabels['ns_st_ams'] = advertisementMetadataObject.extraAdData.adSystem.toLowerCase();
    }

    if (advertisementMetadataObject.extraAdData && advertisementMetadataObject.extraAdData.adTitle) {
      advertisementMetadataLabels['ns_st_amt'] = advertisementMetadataObject.extraAdData.adTitle;
    }

    return advertisementMetadataLabels;
  }

  _getContentMetadataLabels(contentMetadataObject): Object {
    let contentMetadataLabels = {};

    if (this.player.isLive()) {
      contentMetadataLabels['ns_st_li'] = "1";
    }

    if(this.player.config.sources.type == MediaType.AUDIO) {
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
    contentMetadataLabels['ns_st_pn'] = this._contentPartNumber + "";
    contentMetadataLabels['ns_st_tp'] = "0";
    contentMetadataLabels['ns_st_cs'] = "0x0";

    if (this.player.src) {
      contentMetadataLabels['ns_st_cu'] = this.player.src;
    }

    return contentMetadataLabels;
  }

  _getContentMetadataObjects(): Object {
    let contentMetadataObject = [];

    if(this._isAd) {
      contentMetadataObject.push({
        prefix: '',
        map: this._adCachedAdvertisementMetadataObject.extraAdData
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
  _parsePluginConfig(pluginConfig): Object {
    const comScorePluginSettings = Object.assign({}, pluginConfig);

    this._continuousPlaybackSession = comScorePluginSettings[Comscore.SETTING_CONTINUOUS_PLAYBACK_SESSION];

    return comScorePluginSettings;
  }

  _logApiCall(methodName, methodArgs): void {
    const args = Array.from(arguments);
    args.unshift("comScore plugin:");

    this.logger.debug.apply(this.logger, args);

    this._logNotify(methodName, methodArgs)
  }

  _logNotify(methodName, methodArgs): void {
    let payload = {
      api: methodName,
      args: methodArgs
    };

    this.player.dispatchEvent(new FakeEvent(Comscore.PLUGIN_COMSCORE_PLUGIN_EVENT, payload));
  }
}
