#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

extern NSString *const RNAirdropErrorDomain;

/**
 * Objective-C port of android/.../UpdateManager.java. Keep both in sync; the
 * launch/rollback protocol is documented there.
 */
@interface RNAirdropUpdateManager : NSObject

+ (instancetype)shared;

- (nullable NSString *)resolveBundlePath;
- (nullable NSString *)markLaunchSuccessful;
- (void)clearToEmbedded;
- (NSArray<NSString *> *)takeUnreportedRollbacks;

- (NSString *)deviceId;
- (nullable NSString *)launchedUpdateId;
- (nullable NSString *)pendingUpdateId;
- (BOOL)isRollbackToEmbeddedPending;
- (NSArray<NSString *> *)failedUpdateIds;

/** Blocking; call off the main thread. `manifest` is the JSON object from /v1/check. */
- (BOOL)downloadUpdate:(NSDictionary *)manifest error:(NSError **)error;

+ (NSString *)runtimeVersion;
+ (nullable NSString *)infoString:(NSString *)key;
+ (NSString *)signingMessage:(NSDictionary *)manifest;

@end

NS_ASSUME_NONNULL_END
