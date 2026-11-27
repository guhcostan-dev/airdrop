#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Public, React-free entry point (safe to import from Swift).
 *
 * In AppDelegate / ReactNativeDelegate:
 *
 *   override func bundleURL() -> URL? {
 *   #if DEBUG
 *     RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
 *   #else
 *     RNAirdrop.bundleURL()
 *   #endif
 *   }
 */
@interface RNAirdrop : NSObject

/** URL of the OTA bundle to boot, or the embedded main.jsbundle. */
+ (nullable NSURL *)bundleURL;

/** Same, with a custom fallback for apps that embed the bundle under another name. */
+ (nullable NSURL *)bundleURLWithEmbeddedURL:(nullable NSURL *)embeddedURL;

@end

NS_ASSUME_NONNULL_END
