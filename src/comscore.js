// @flow
import {BasePlugin, MediaType, Utils} from 'playkit-js'
import ns_ from "../bin/streamsense.plugin.min.js"

/**
 * Your class description.
 * @classdesc
 */
export default class Comscore extends BasePlugin {


  _streamingAnalytics: any;
  _trackEventMonitorCallbackName: string;
  labels: Object;
  _isBuffering: boolean;
  _gPlugin: Object;
  _lastKnownPosition: Number;
  _lastKnownAdPosition: Number;
  _assetPartNumber: Number;
  _isAd: boolean = false;
  _adCachedAdvertisementMetadataObject: Object;

  _gPluginPromise: Promise<*>;

  static PLUGIN_VERSION = "2.0";
  static PLUGIN_PLATFORM_NAME = "kaltura";

  /**
   * TODO: Define under what conditions the plugin is valid.
   * @static
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

    this._trackEventMonitorCallbackName = config.trackEventMonitor;

    this._init();

    this._assetPartNumber = 1;

    /**
     Now you have access to the BasePlugin members:
     1. config: The runtime configuration of the plugin.
     2. name: The name of the plugin.
     3. logger: The logger of the plugin.
     4. player: Reference to the actual player.
     5. eventManager: The event manager of the plugin.
    */
  }

  /**
   * Initializing the plugin.
   * @private
   * @returns {void}
   */
  _init(): void {
    this._gPluginPromise = Utils.Object.defer();

    this.player.ready().then(() => {
      this.logger.debug("The comScore onReady event was triggered.");

      let pluginConfig = this._parsePluginConfig(this.config);

      this._gPlugin = new ns_.StreamingAnalytics.Plugin(pluginConfig, Comscore.PLUGIN_PLATFORM_NAME, Comscore.PLUGIN_VERSION, window.KalturaPlayer.VERSION, {
        position: this._getCurrentPosition.bind(this),
        // preMeasurement: function (currentState, newEvent) {
        //   var apiCallName = 'notify' + eventTypeToAPICallMapping[newEvent];
        //
        //   trackEventMonitorLoggingNotify(apiCallName, getCurrentPosition());
        //
        //   return true;
        // }
      });

      this._gPluginPromise.resolve();
    });

    this._addBindings();
  }

  _getCurrentPosition(): void {
    if(this._isAd) {
      return this._lastKnownPosition;
    }

    return  Math.floor(this.player.currentTime * 1000);
  }

  _addBindings(): void {
    let listeners = {
      [this.player.Event.SOURCE_SELECTED]: this._onSourceSelected,
      [this.player.Event.ERROR]: this._onError,
      [this.player.Event.FIRST_PLAY]: this._onFirstPlay,
      [this.player.Event.PLAYING]: this._onPlaying,
      [this.player.Event.SEEKING]: this._onSeeking,
      [this.player.Event.PAUSE]: this._onPause,
      [this.player.Event.ENDED]: this._onEnded,
      [this.player.Event.TIME_UPDATE]: this._onTimeUpdate,
      [this.player.Event.VIDEO_TRACK_CHANGED]: this._onVideoTrackChanged,
      [this.player.Event.AUDIO_TRACK_CHANGED]: this._onAudioTrackChanged,
      [this.player.Event.TEXT_TRACK_CHANGED]: this._onTextTrackChanged,
      [this.player.Event.PLAYER_STATE_CHANGED]: this._onPlayerStateChanged,
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
      [this.player.Event.USER_CLOSED_AD]: this._onUserClosedAd,
      [this.player.Event.AD_VOLUME_CHANGED]: this._onAdVolumeChanged,
      [this.player.Event.AD_MUTED]: this._onAdMuted,
      [this.player.Event.AD_PROGRESS]: this._onAdProgress,
    };

    for (const [eventName, listener] of Object.entries(listeners)) {
      this.eventManager.listen(this.player, eventName, (event) => {
        this._gPluginPromise.then(() => {
          this._log("Event:", eventName, event);

          listener.call(this, event);
        });
      });
    }
  }

  _onError(event: ErrorEvent): void {
    //TODO: Check if error is critical and if so send ended
  }

  _onAdLoaded(event): void {
    this._adCachedAdvertisementMetadataObject = event.payload;
  }

  _onAdBreakStart(event): void {
    this._isAd = true;
  }
  _onAdStarted(event): void {
    this._gPlugin.setAsset(this._getAdvertisementMetadataLabels(this._adCachedAdvertisementMetadataObject, this.player.config), false, this._getContentMetadataObjects());

    this._sendCommand('notifyPlay');
  }
  _onAdResumed(event): void {
    this._sendCommand('notifyPlay');
  }
  _onAdPaused(event): void {
    this._sendCommand('notifyPause');
  }
  _onAdClicked(event): void {
  }
  _onAdSkipped(event): void {
    this._sendCommand('notifySkipAd');
  }
  _onAdCompleted(event): void {
    if(this._adCachedAdvertisementMetadataObject.extraAdData && this._adCachedAdvertisementMetadataObject.extraAdData.duration) {
      let duration = Math.floor(this._adCachedAdvertisementMetadataObject.extraAdData.duration * 1000);
      this._sendCommand('notifyEnd', duration);
    } else {
      this._sendCommand('notifyEnd');
    }
  }
  _onAdError(event): void {
  }
  _onAllAdsCompleted(event): void {
  }
  _onAdBreakEnd(event): void {
    this._isAd = false;

    // We've finished with the ad break, moving back to content asset.
    this._gPlugin.setAsset(this._getContentMetadataLabels(this.player.config), false, this._getContentMetadataObjects());
  }
  _onUserClosedAd(event): void {
  }
  _onAdVolumeChanged(event): void {
  }
  _onAdMuted(event): void {
  }
  _onAdProgress(event): void {
    this._lastKnownAdPosition = Math.floor(event.payload.adProgress.currentTime);
  }

  _onVideoTrackChanged(event): void {
    // TODO
  }

  _onPlayerStateChanged(event): void {
    const oldState = event.payload.oldState;
    const newState = event.payload.newState;

    if (oldState.type === this.player.State.BUFFERING) {
      this._isBuffering = false;
      this._sendCommand("notifyBufferStop");
    }

    if (newState.type === this.player.State.BUFFERING) {
      this._isBuffering = true;
      this._sendCommand("notifyBufferStart");
    }
  }

  _onSeeking(): void {
    this._log("Seeking from", this._lastKnownPosition, "to", this._getCurrentPosition());

    this._sendCommand("notifySeekStart", this._lastKnownPosition);
  }

  _onPlaying(): void{
      this._sendCommand("notifyPlay");
  }

  _onFirstPlay(): void {
    this._sendCommand('notifyPlay');
}

  _onEnded(): void {
    this._sendCommand("notifyEnd");
  }

  _onPause(): void {
    // When playing content and an Ad is about to be played, a Pause event is triggered.
    if(this._isAd) return;

    this._sendCommand("notifyPause");
  }

  _onTimeUpdate(): void {
    this._log("comscore", "_onTimeUpdate", this._getCurrentPosition());

    this._lastKnownPosition = this._getCurrentPosition();
  }

  _onSourceSelected(): void {
    this._gPlugin.createPlaybackSession();
    this._gPlugin.setAsset(this._getContentMetadataLabels(this.player.config), false, this._getContentMetadataObjects());
  }

  _sendCommand(notifyCommandName: string, position: Number): void {
    this.logger.debug("Going to send:" + notifyCommandName + "  with position:" + position);

    try {
      this._gPlugin[notifyCommandName](position);
    } catch(e){
      this.logger.error("Error occur while trying to send:" + notifyCommandName +" to comscore",e);
    }
  }

  /**
   * TODO: Define the destroy logic of your plugin.
   * Destroys the plugin.
   * @override
   * @public
   * @returns {void}
   */
  destroy(): void {
    this.eventManager.destroy();
  }

  /**
   * TODO: Define the reset logic of your plugin.
   * Resets the plugin.
   * @override
   * @public
   * @returns {void}
   */
  reset(): void {
  // Write logic
  }

  _getAdvertisementMetadataLabels(advertisementMetadataObject, relatedContentMetadataObject): Object {
    const advertisementMetadataLabels = {};
    const contentMetadataLabels = this._getContentMetadataLabels(relatedContentMetadataObject);

    if(contentMetadataLabels['ns_st_pl']) {
      advertisementMetadataLabels['ns_st_pl'] = contentMetadataLabels['ns_st_pl'];
    }
    if(contentMetadataLabels['ns_st_pr']) {
      advertisementMetadataLabels['ns_st_pr'] = contentMetadataLabels['ns_st_pr'];
    }
    if(contentMetadataLabels['ns_st_ep']){
      advertisementMetadataLabels['ns_st_ep'] = contentMetadataLabels['ns_st_ep'];
    }

    if (this.player.isLive()) {
      advertisementMetadataLabels['ns_st_li'] = "1";
    }

    if(advertisementMetadataObject.extraAdData && advertisementMetadataObject.extraAdData.adId) {
      advertisementMetadataLabels['ns_st_ci'] = advertisementMetadataObject.extraAdData.adId + '';
    }

    advertisementMetadataLabels['ns_st_pn'] = "1"; // Current part number of the ad. Always assume part 1.
    advertisementMetadataLabels['ns_st_tp'] = "1"; // Always assume ads have a total // Playlist title. of 1 parts.

    if(advertisementMetadataLabels.extraAdData && advertisementMetadataObject.extraAdData.duration) {
      advertisementMetadataLabels['ns_st_cl'] = Math.floor(advertisementMetadataObject.extraAdData.duration * 1000);
    }

    // advertisementMetadataLabels.ns_st_an = adNumber + ""; TODO

    if (advertisementMetadataObject.adType == 'preroll') {
      advertisementMetadataLabels['ns_st_ad'] = "pre-roll";
      advertisementMetadataLabels['ns_st_ct'] = "va11";
    } else if (advertisementMetadataObject.adType == 'postroll') {
      advertisementMetadataLabels['ns_st_ad'] = "post-roll";
      advertisementMetadataLabels['ns_st_ct'] = "va13";
    } else if (advertisementMetadataObject.adType == 'midroll') {
      advertisementMetadataLabels['ns_st_ad'] = "mid-roll";
      advertisementMetadataLabels['ns_st_ct'] = "va12";
    } else {
      // This should never happen.
      advertisementMetadataLabels['ns_st_ad'] = 1;
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

    if(this.player.config.type == MediaType.AUDIO) {
      contentMetadataLabels['ns_st_ct'] = 'ac00';
      contentMetadataLabels['ns_st_ty'] = 'audio';
    } else {
      contentMetadataLabels['ns_st_ct'] = 'vc00';
      contentMetadataLabels['ns_st_ty'] = 'video';
    }

    contentMetadataLabels['ns_st_pl'] = contentMetadataObject.name;
    contentMetadataLabels['ns_st_pr'] = contentMetadataObject.name;
    contentMetadataLabels['ns_st_ep'] = contentMetadataObject.name;
    contentMetadataLabels['ns_st_cl'] = contentMetadataObject.duration; // or .duration in seconds
    contentMetadataLabels['ns_st_ci'] = contentMetadataObject.id;
    contentMetadataLabels['ns_st_pn'] = this._assetPartNumber + ""; // TODO
    contentMetadataLabels['ns_st_tp'] = "0";
    contentMetadataLabels['ns_st_cs'] = "0x0";

    // tODO
    // if (mediaProxyEntry.downloadUrl)
    //   contentMetadataLabels['ns_st_cu'] = mediaProxyEntry.downloadUrl;

    return contentMetadataLabels;
  }

  _getContentMetadataObjects(): Object {
    return [
      {
        prefix: '',
        map: this.player.config.metadata
      },
      {
        prefix: 'clip',
        map: this.player.config
      },
      {
        prefix: 'content',
        map: this.player.config
      },
      {
        prefix: 'content.session',
        map: this.player.config.session
      },
      {
        prefix: 'content.playback',
        map: this.player.config.playback
      }
    ];
  }

  /**
   * Prepares the object to be consumed by the comScore Generic Plugin Library.
   * @private
   * @param {object} pluginConfig - Plugin configuration object.
   * @returns {object} The object to be consumed by the comScore Generic Plugin library.
   * */
  _parsePluginConfig(pluginConfig): Object {
    pluginConfig = pluginConfig || {};

    let comScorePlugin = {
      publisherId: this.player.config.session && this.player.config.session.partnerId,
      debug: pluginConfig.debug || true
    };

    return comScorePlugin;
  }

  _log(): void {
    const args = Array.from(arguments);
    args.unshift("comScore plugin:");

    this.logger.debug.apply(this.logger, args);
    // this.logger.debug("The comScore onReady event was triggered.");
  }
}
