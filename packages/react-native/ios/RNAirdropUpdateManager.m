#import "RNAirdropUpdateManager.h"
#import <CommonCrypto/CommonDigest.h>
#import <Security/Security.h>

NSString *const RNAirdropErrorDomain = @"RNAirdrop";
static NSString *const kEmbedded = @"embedded";
static NSString *const kManifestFile = @"airdrop-manifest.txt";
static NSString *const kLaunchFile = @"main.jsbundle";

@implementation RNAirdropUpdateManager {
  NSString *_baseDir;
  NSString *_updatesDir;
  NSString *_statePath;
  NSString *_binaryVersion;
  NSString *_publicKey;
  NSMutableDictionary<NSString *, id> *_state;
  NSString *_launchedUpdateId;
  NSString *_launchedPath;
  BOOL _resolved;
}

+ (instancetype)shared {
  static RNAirdropUpdateManager *instance;
  static dispatch_once_t once;
  dispatch_once(&once, ^{ instance = [RNAirdropUpdateManager new]; });
  return instance;
}

- (instancetype)init {
  if ((self = [super init])) {
    NSString *support = NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES).firstObject;
    _baseDir = [support stringByAppendingPathComponent:@"airdrop"];
    _updatesDir = [_baseDir stringByAppendingPathComponent:@"updates"];
    _statePath = [_baseDir stringByAppendingPathComponent:@"state.plist"];
    _binaryVersion = [RNAirdropUpdateManager binaryVersion];
    _publicKey = [RNAirdropUpdateManager infoString:@"AirdropPublicKey"];
    [[NSFileManager defaultManager] createDirectoryAtPath:_baseDir withIntermediateDirectories:YES attributes:nil error:nil];
    // Downloaded bundles can be re-fetched; keep them out of iCloud backups.
    [[NSURL fileURLWithPath:_baseDir] setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:nil];

    NSDictionary *saved = [NSDictionary dictionaryWithContentsOfFile:_statePath];
    _state = saved ? [saved mutableCopy] : [NSMutableDictionary new];
    if (![_binaryVersion isEqualToString:_state[@"binaryVersion"]]) {
      // Fresh install or new store build: the embedded bundle supersedes downloaded ones.
      NSString *deviceId = _state[@"deviceId"];
      [_state removeAllObjects];
      if (deviceId) _state[@"deviceId"] = deviceId;
      _state[@"binaryVersion"] = _binaryVersion;
      [[NSFileManager defaultManager] removeItemAtPath:_updatesDir error:nil];
      [self saveState];
    }
  }
  return self;
}

#pragma mark - Config

+ (nullable NSString *)infoString:(NSString *)key {
  id value = [[NSBundle mainBundle] objectForInfoDictionaryKey:key];
  if (![value isKindOfClass:[NSString class]]) return nil;
  NSString *trimmed = [value stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  return trimmed.length ? trimmed : nil;
}

/** Must match the CLI: AirdropRuntimeVersion, else CFBundleShortVersionString. */
+ (NSString *)runtimeVersion {
  return [self infoString:@"AirdropRuntimeVersion"] ?: [self infoString:@"CFBundleShortVersionString"] ?: @"1.0";
}

+ (NSString *)binaryVersion {
  NSString *version = [self infoString:@"CFBundleShortVersionString"] ?: @"";
  NSString *build = [self infoString:@"CFBundleVersion"] ?: @"";
  NSString *exe = [[NSBundle mainBundle] executablePath];
  NSDate *modified = exe ? [[NSFileManager defaultManager] attributesOfItemAtPath:exe error:nil][NSFileModificationDate] : nil;
  return [NSString stringWithFormat:@"%@(%@)@%.0f", version, build, modified.timeIntervalSince1970];
}

#pragma mark - Launch

- (nullable NSString *)resolveBundlePath {
  @synchronized(self) {
    // Asked again in the same process (JS reload): keep the running bundle unless a
    // new update was staged since, which is how "immediate" installs apply in-process.
    if (_resolved) {
      NSString *p = _state[@"pending"];
      BOOL freshPending = p && ![p isEqualToString:_launchedUpdateId] && ![_state[@"pendingLaunched"] boolValue];
      if (!freshPending) return _launchedPath;
    }
    _resolved = YES;

    NSString *pending = _state[@"pending"];
    if (pending) {
      if ([pending isEqualToString:kEmbedded]) {
        [_state removeObjectsForKeys:@[ @"current", @"pending", @"pendingLaunched" ]];
        [self saveState];
      } else if ([_state[@"pendingLaunched"] boolValue]) {
        [self rollBack:pending];
      } else if ([self bundleExists:pending]) {
        _state[@"pendingLaunched"] = @YES;
        [self saveState];
        return [self launch:pending];
      } else {
        [self rollBack:pending];
      }
    }

    NSString *current = _state[@"current"];
    if (current) {
      if ([self bundleExists:current]) return [self launch:current];
      [_state removeObjectForKey:@"current"];
      [self saveState];
    }
    return [self launch:nil];
  }
}

- (nullable NSString *)launch:(nullable NSString *)updateId {
  _launchedUpdateId = updateId;
  _launchedPath = updateId ? [self bundlePath:updateId] : nil;
  return _launchedPath;
}

- (void)rollBack:(NSString *)updateId {
  [self addTo:@"failed" value:updateId];
  [self addTo:@"unreportedRollbacks" value:updateId];
  [_state removeObjectsForKeys:@[ @"pending", @"pendingLaunched" ]];
  [self saveState];
  [[NSFileManager defaultManager] removeItemAtPath:[_updatesDir stringByAppendingPathComponent:updateId] error:nil];
}

- (nullable NSString *)markLaunchSuccessful {
  @synchronized(self) {
    NSString *pending = _state[@"pending"];
    if (!_launchedUpdateId || ![_launchedUpdateId isEqualToString:pending]) return nil;
    if (![_state[@"pendingLaunched"] boolValue]) return nil;
    _state[@"current"] = pending;
    [_state removeObjectsForKeys:@[ @"pending", @"pendingLaunched" ]];
    [self saveState];
    [self garbageCollect];
    return pending;
  }
}

- (void)clearToEmbedded {
  @synchronized(self) {
    if (!_state[@"current"] && !_state[@"pending"]) return;
    _state[@"pending"] = kEmbedded;
    [_state removeObjectForKey:@"pendingLaunched"];
    [self saveState];
  }
}

- (NSArray<NSString *> *)takeUnreportedRollbacks {
  @synchronized(self) {
    NSArray *list = _state[@"unreportedRollbacks"] ?: @[];
    [_state removeObjectForKey:@"unreportedRollbacks"];
    [self saveState];
    return list;
  }
}

#pragma mark - Queries

- (NSString *)deviceId {
  @synchronized(self) {
    NSString *deviceId = _state[@"deviceId"];
    if (!deviceId) {
      deviceId = [[NSUUID UUID].UUIDString lowercaseString];
      _state[@"deviceId"] = deviceId;
      [self saveState];
    }
    return deviceId;
  }
}

- (nullable NSString *)launchedUpdateId {
  @synchronized(self) { return _launchedUpdateId; }
}

- (nullable NSString *)pendingUpdateId {
  @synchronized(self) {
    NSString *p = _state[@"pending"];
    if (!p || [p isEqualToString:kEmbedded] || [p isEqualToString:_launchedUpdateId]) return nil;
    return p;
  }
}

- (BOOL)isRollbackToEmbeddedPending {
  @synchronized(self) { return [_state[@"pending"] isEqualToString:kEmbedded]; }
}

- (NSArray<NSString *> *)failedUpdateIds {
  @synchronized(self) { return _state[@"failed"] ?: @[]; }
}

#pragma mark - Download

static NSError *AirdropError(NSString *code, NSString *message) {
  return [NSError errorWithDomain:RNAirdropErrorDomain
                             code:1
                         userInfo:@{NSLocalizedDescriptionKey : message, @"code" : code}];
}

static BOOL IsSafePath(id path) {
  if (![path isKindOfClass:[NSString class]]) return NO;
  NSString *p = path;
  if (p.length == 0 || [p hasPrefix:@"/"] || [p containsString:@"\\"] || [p isEqualToString:kManifestFile]) return NO;
  for (NSString *seg in [p componentsSeparatedByString:@"/"]) {
    if (seg.length == 0 || [seg isEqualToString:@"."] || [seg isEqualToString:@".."]) return NO;
  }
  return YES;
}

static BOOL IsHash(id hash) {
  if (![hash isKindOfClass:[NSString class]] || [hash length] != 64) return NO;
  NSCharacterSet *invalid = [[NSCharacterSet characterSetWithCharactersInString:@"0123456789abcdef"] invertedSet];
  return [hash rangeOfCharacterFromSet:invalid].location == NSNotFound;
}

static NSString *HexString(const unsigned char *bytes, size_t len) {
  NSMutableString *out = [NSMutableString stringWithCapacity:len * 2];
  for (size_t i = 0; i < len; i++) [out appendFormat:@"%02x", bytes[i]];
  return out;
}

static NSString *Sha256OfData(NSData *data) {
  unsigned char digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(data.bytes, (CC_LONG)data.length, digest);
  return HexString(digest, CC_SHA256_DIGEST_LENGTH);
}

static NSString *Sha256OfFile(NSString *path) {
  NSData *data = [NSData dataWithContentsOfFile:path options:NSDataReadingMappedIfSafe error:nil];
  return data ? Sha256OfData(data) : @"";
}

/** Mirrors signingMessage() in packages/core/src/signing.ts. */
+ (NSString *)signingMessage:(NSDictionary *)m {
  NSMutableArray<NSString *> *assets = [NSMutableArray new];
  for (NSDictionary *a in m[@"assets"]) [assets addObject:[NSString stringWithFormat:@"%@:%@", a[@"path"], a[@"hash"]]];
  // Ordinal (code-unit) ordering, identical to the JS and Java implementations.
  [assets sortUsingComparator:^NSComparisonResult(NSString *a, NSString *b) { return [a compare:b options:NSLiteralSearch]; }];
  NSMutableArray *lines = [@[ @"airdrop-v1", m[@"runtimeVersion"], m[@"platform"],
                              [NSString stringWithFormat:@"%@:%@", m[@"launchAsset"][@"path"], m[@"launchAsset"][@"hash"]] ] mutableCopy];
  [lines addObjectsFromArray:assets];
  return [lines componentsJoinedByString:@"\n"];
}

- (BOOL)verifySignature:(NSDictionary *)m error:(NSError **)error {
  NSString *signature = [m[@"signature"] isKindOfClass:[NSString class]] ? m[@"signature"] : nil;
  if (!signature.length) {
    if (error) *error = AirdropError(@"ERR_SIGNATURE", @"update is not signed but this binary requires signed updates");
    return NO;
  }
  NSData *keyData = [[NSData alloc] initWithBase64EncodedString:_publicKey options:0];
  NSData *sigData = [[NSData alloc] initWithBase64EncodedString:signature options:0];
  if (keyData.length != 65 || !sigData) {
    if (error) *error = AirdropError(@"ERR_SIGNATURE", @"invalid public key or signature encoding");
    return NO;
  }
  NSDictionary *attrs = @{
    (__bridge id)kSecAttrKeyType : (__bridge id)kSecAttrKeyTypeECSECPrimeRandom,
    (__bridge id)kSecAttrKeyClass : (__bridge id)kSecAttrKeyClassPublic,
    (__bridge id)kSecAttrKeySizeInBits : @256,
  };
  CFErrorRef cfError = NULL;
  SecKeyRef key = SecKeyCreateWithData((__bridge CFDataRef)keyData, (__bridge CFDictionaryRef)attrs, &cfError);
  if (!key) {
    if (cfError) CFRelease(cfError);
    if (error) *error = AirdropError(@"ERR_SIGNATURE", @"invalid public key in Info.plist");
    return NO;
  }
  NSData *message = [[RNAirdropUpdateManager signingMessage:m] dataUsingEncoding:NSUTF8StringEncoding];
  BOOL ok = SecKeyVerifySignature(key, kSecKeyAlgorithmECDSASignatureMessageX962SHA256, (__bridge CFDataRef)message,
                                  (__bridge CFDataRef)sigData, &cfError);
  CFRelease(key);
  if (cfError) CFRelease(cfError);
  if (!ok && error) *error = AirdropError(@"ERR_SIGNATURE", @"signature verification failed");
  return ok;
}

- (BOOL)validate:(NSDictionary *)m error:(NSError **)error {
  NSString *updateId = m[@"id"];
  NSDictionary *launch = m[@"launchAsset"];
  if (![updateId isKindOfClass:[NSString class]] || updateId.length != 36 || ![launch isKindOfClass:[NSDictionary class]] ||
      ![m[@"assets"] isKindOfClass:[NSArray class]]) {
    if (error) *error = AirdropError(@"ERR_INVALID_MANIFEST", @"malformed manifest");
    return NO;
  }
  if (![launch[@"path"] isEqual:kLaunchFile]) {
    if (error) *error = AirdropError(@"ERR_INVALID_MANIFEST", @"launch asset must be named main.jsbundle");
    return NO;
  }
  NSMutableArray *all = [m[@"assets"] mutableCopy];
  [all addObject:launch];
  for (NSDictionary *f in all) {
    if (![f isKindOfClass:[NSDictionary class]] || !IsSafePath(f[@"path"]) || !IsHash(f[@"hash"]) ||
        ![f[@"url"] isKindOfClass:[NSString class]] || ![NSURL URLWithString:f[@"url"]]) {
      if (error) *error = AirdropError(@"ERR_INVALID_MANIFEST", @"invalid file entry");
      return NO;
    }
  }
  return YES;
}

- (BOOL)downloadUpdate:(NSDictionary *)m error:(NSError **)error {
  if (![self validate:m error:error]) return NO;
  NSString *updateId = m[@"id"];
  @synchronized(self) {
    if ([self.failedUpdateIds containsObject:updateId]) {
      if (error) *error = AirdropError(@"ERR_UPDATE_FAILED_BEFORE", @"update previously failed to launch");
      return NO;
    }
    if ([updateId isEqualToString:_launchedUpdateId] || [updateId isEqualToString:_state[@"pending"]]) return YES;
  }
  // Signing is opt-in: enforced only when the binary embeds a public key.
  if (_publicKey && ![self verifySignature:m error:error]) return NO;

  NSFileManager *fm = [NSFileManager defaultManager];
  NSString *staging = [_updatesDir stringByAppendingPathComponent:[updateId stringByAppendingString:@".tmp"]];
  [fm removeItemAtPath:staging error:nil];
  [fm createDirectoryAtPath:staging withIntermediateDirectories:YES attributes:nil error:nil];

  NSDictionary<NSString *, NSString *> *reusable = [self reusableFiles];
  NSMutableArray<NSDictionary *> *files = [NSMutableArray arrayWithObject:m[@"launchAsset"]];
  [files addObjectsFromArray:m[@"assets"]];
  NSMutableString *manifestText = [NSMutableString new];

  for (NSDictionary *f in files) {
    NSString *target = [staging stringByAppendingPathComponent:f[@"path"]];
    [fm createDirectoryAtPath:[target stringByDeletingLastPathComponent] withIntermediateDirectories:YES attributes:nil error:nil];
    NSString *existing = reusable[f[@"hash"]];
    if (existing && [Sha256OfFile(existing) isEqualToString:f[@"hash"]] && [fm copyItemAtPath:existing toPath:target error:nil]) {
      // Reused an unchanged file from the running update.
    } else if (![self downloadFile:f to:target error:error]) {
      [fm removeItemAtPath:staging error:nil];
      return NO;
    }
    [manifestText appendFormat:@"%@\t%@\n", f[@"path"], f[@"hash"]];
  }
  [manifestText writeToFile:[staging stringByAppendingPathComponent:kManifestFile] atomically:YES encoding:NSUTF8StringEncoding error:nil];

  NSString *finalDir = [_updatesDir stringByAppendingPathComponent:updateId];
  [fm removeItemAtPath:finalDir error:nil];
  if (![fm moveItemAtPath:staging toPath:finalDir error:nil]) {
    [fm removeItemAtPath:staging error:nil];
    if (error) *error = AirdropError(@"ERR_IO", @"cannot move staged update");
    return NO;
  }

  @synchronized(self) {
    NSString *previousPending = _state[@"pending"];
    _state[@"pending"] = updateId;
    [_state removeObjectForKey:@"pendingLaunched"];
    [self saveState];
    if (previousPending && ![previousPending isEqualToString:kEmbedded] && ![previousPending isEqualToString:_launchedUpdateId]) {
      [fm removeItemAtPath:[_updatesDir stringByAppendingPathComponent:previousPending] error:nil];
    }
  }
  return YES;
}

- (BOOL)downloadFile:(NSDictionary *)f to:(NSString *)target error:(NSError **)error {
  NSURLSessionConfiguration *config = [NSURLSessionConfiguration ephemeralSessionConfiguration];
  config.timeoutIntervalForRequest = 30;
  NSURLSession *session = [NSURLSession sessionWithConfiguration:config];
  NSString *lastError = @"download failed";
  for (int attempt = 0; attempt < 3; attempt++) {
    __block NSData *body = nil;
    __block NSInteger status = 0;
    __block NSError *netError = nil;
    dispatch_semaphore_t done = dispatch_semaphore_create(0);
    // NSURLSession negotiates gzip and decodes Content-Encoding transparently.
    [[session dataTaskWithURL:[NSURL URLWithString:f[@"url"]]
            completionHandler:^(NSData *data, NSURLResponse *response, NSError *err) {
              body = data;
              netError = err;
              status = [response isKindOfClass:[NSHTTPURLResponse class]] ? ((NSHTTPURLResponse *)response).statusCode : 0;
              dispatch_semaphore_signal(done);
            }] resume];
    dispatch_semaphore_wait(done, DISPATCH_TIME_FOREVER);
    if (netError || status >= 500) {
      lastError = netError.localizedDescription ?: [NSString stringWithFormat:@"HTTP %ld", (long)status];
      continue;
    }
    if (status != 200 || !body) {
      lastError = [NSString stringWithFormat:@"HTTP %ld for %@", (long)status, f[@"path"]];
      break;
    }
    if (![Sha256OfData(body) isEqualToString:f[@"hash"]]) {
      [session finishTasksAndInvalidate];
      if (error) *error = AirdropError(@"ERR_HASH_MISMATCH", [NSString stringWithFormat:@"hash mismatch for %@", f[@"path"]]);
      return NO;
    }
    [session finishTasksAndInvalidate];
    if (![body writeToFile:target atomically:YES]) {
      if (error) *error = AirdropError(@"ERR_IO", @"cannot write file");
      return NO;
    }
    return YES;
  }
  [session finishTasksAndInvalidate];
  if (error) *error = AirdropError(@"ERR_DOWNLOAD", lastError);
  return NO;
}

- (NSDictionary<NSString *, NSString *> *)reusableFiles {
  NSMutableDictionary *out = [NSMutableDictionary new];
  NSArray *ids;
  @synchronized(self) {
    NSMutableArray *list = [NSMutableArray new];
    for (id x in @[ _state[@"current"] ?: [NSNull null], _launchedUpdateId ?: [NSNull null], _state[@"pending"] ?: [NSNull null] ]) {
      if ([x isKindOfClass:[NSString class]] && ![x isEqualToString:kEmbedded]) [list addObject:x];
    }
    ids = list;
  }
  for (NSString *updateId in ids) {
    NSString *dir = [_updatesDir stringByAppendingPathComponent:updateId];
    NSString *text = [NSString stringWithContentsOfFile:[dir stringByAppendingPathComponent:kManifestFile] encoding:NSUTF8StringEncoding error:nil];
    for (NSString *line in [text componentsSeparatedByString:@"\n"]) {
      NSArray *parts = [line componentsSeparatedByString:@"\t"];
      if (parts.count == 2) out[parts[1]] = [dir stringByAppendingPathComponent:parts[0]];
    }
  }
  return out;
}

- (void)garbageCollect {
  NSString *current = _state[@"current"], *pending = _state[@"pending"];
  for (NSString *name in [[NSFileManager defaultManager] contentsOfDirectoryAtPath:_updatesDir error:nil]) {
    if ([name isEqualToString:current] || [name isEqualToString:pending] || [name isEqualToString:_launchedUpdateId]) continue;
    [[NSFileManager defaultManager] removeItemAtPath:[_updatesDir stringByAppendingPathComponent:name] error:nil];
  }
}

#pragma mark - Helpers

- (NSString *)bundlePath:(NSString *)updateId {
  return [[_updatesDir stringByAppendingPathComponent:updateId] stringByAppendingPathComponent:kLaunchFile];
}

- (BOOL)bundleExists:(NSString *)updateId {
  return [[NSFileManager defaultManager] fileExistsAtPath:[self bundlePath:updateId]];
}

- (void)addTo:(NSString *)key value:(NSString *)value {
  NSMutableArray *list = [(_state[key] ?: @[]) mutableCopy];
  if (![list containsObject:value]) [list addObject:value];
  while (list.count > 50) [list removeObjectAtIndex:0];
  _state[key] = list;
}

- (void)saveState {
  // writeToFile:atomically: writes a temp file and renames it.
  [_state writeToFile:_statePath atomically:YES];
}

@end
