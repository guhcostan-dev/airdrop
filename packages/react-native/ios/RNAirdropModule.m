#import <React/RCTBridgeModule.h>
#import <React/RCTReloadCommand.h>
#import "RNAirdropUpdateManager.h"

@interface RNAirdropModule : NSObject <RCTBridgeModule>
@end

@implementation RNAirdropModule

// Classic module: works on the old architecture and via the new-arch interop layer.
RCT_EXPORT_MODULE(RNAirdrop)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSDictionary *)constantsToExport {
  return @{
    @"platform" : @"ios",
    @"sdkVersion" : @"0.2.0",
#if DEBUG
    @"enabled" : @([[RNAirdropUpdateManager infoString:@"AirdropEnableInDebug"] isEqualToString:@"true"]),
#else
    @"enabled" : @YES,
#endif
    @"runtimeVersion" : [RNAirdropUpdateManager runtimeVersion],
    @"serverUrl" : [RNAirdropUpdateManager infoString:@"AirdropServerURL"] ?: [NSNull null],
    @"appId" : [RNAirdropUpdateManager infoString:@"AirdropAppId"] ?: [NSNull null],
    @"channel" : [RNAirdropUpdateManager infoString:@"AirdropChannel"] ?: @"production",
  };
}

RCT_EXPORT_METHOD(getState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  RNAirdropUpdateManager *m = [RNAirdropUpdateManager shared];
  resolve(@{
    @"deviceId" : m.deviceId,
    @"currentUpdateId" : m.launchedUpdateId ?: [NSNull null],
    @"pendingUpdateId" : m.pendingUpdateId ?: [NSNull null],
    @"rollbackToEmbeddedPending" : @(m.isRollbackToEmbeddedPending),
    @"failedUpdateIds" : m.failedUpdateIds,
  });
}

RCT_EXPORT_METHOD(downloadUpdate:(NSDictionary *)manifest resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
    NSError *error = nil;
    if ([[RNAirdropUpdateManager shared] downloadUpdate:manifest error:&error]) {
      resolve(manifest[@"id"]);
    } else {
      reject(error.userInfo[@"code"] ?: @"ERR_DOWNLOAD", error.localizedDescription, error);
    }
  });
}

RCT_EXPORT_METHOD(notifyAppReady:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  RNAirdropUpdateManager *m = [RNAirdropUpdateManager shared];
  NSString *installed = [m markLaunchSuccessful];
  resolve(@{
    @"installedUpdateId" : installed ?: [NSNull null],
    @"rolledBackUpdateIds" : [m takeUnreportedRollbacks],
  });
}

RCT_EXPORT_METHOD(clearUpdates:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [[RNAirdropUpdateManager shared] clearToEmbedded];
  resolve(nil);
}

/** Reloads JS; the bridge/host asks the AppDelegate for bundleURL again, which now returns the pending update. */
RCT_EXPORT_METHOD(restartApp) {
  dispatch_async(dispatch_get_main_queue(), ^{ RCTTriggerReloadCommandListeners(@"airdrop: apply update"); });
}

@end
