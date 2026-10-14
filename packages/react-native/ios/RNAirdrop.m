#import "RNAirdrop.h"
#import "RNAirdropUpdateManager.h"

@implementation RNAirdrop

+ (nullable NSURL *)bundleURL {
  return [self bundleURLWithEmbeddedURL:[[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"]];
}

+ (nullable NSURL *)bundleURLWithEmbeddedURL:(nullable NSURL *)embeddedURL {
  @try {
    NSString *path = [[RNAirdropUpdateManager shared] resolveBundlePath];
    if (path) {
      NSLog(@"[Airdrop] Launching OTA bundle %@", path);
      return [NSURL fileURLWithPath:path];
    }
  } @catch (NSException *e) {
    // Never let the updater prevent the app from booting.
    NSLog(@"[Airdrop] Failed to resolve bundle, using embedded one: %@", e);
  }
  return embeddedURL;
}

@end
