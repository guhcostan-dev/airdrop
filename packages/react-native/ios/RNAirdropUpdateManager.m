#import "RNAirdropUpdateManager.h"
#import <CommonCrypto/CommonDigest.h>
#import <Security/Security.h>

NSString *const RNAirdropErrorDomain = @"RNAirdrop";
static NSString *const kEmbedded = @"embedded";
static NSString *const kManifestFile = @"airdrop-manifest.txt";
static const NSUInteger kMaxAssetDownloads = 6;
static NSString *const kLaunchFile = @"main.jsbundle";

@implementation RNAirdropUpdateManager {
  NSString *_baseDir;
  NSString *_updatesDir;
  NSString *_statePath;
  NSString *_staging;
  NSObject *_downloadLock;
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
    _staging = [_baseDir stringByAppendingPathComponent:@"staging"];
    _downloadLock = [NSObject new];
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
      [[NSFileManager defaultManager] removeItemAtPath:_staging error:nil];
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

static NSString *Sha256OfFile(NSString *path) {
  NSInputStream *stream = [NSInputStream inputStreamWithFileAtPath:path];
  if (!stream) return nil;
  [stream open];
  CC_SHA256_CTX context;
  CC_SHA256_Init(&context);
  uint8_t buffer[64 * 1024];
  NSInteger count;
  while ((count = [stream read:buffer maxLength:sizeof(buffer)]) > 0) {
    CC_SHA256_Update(&context, buffer, (CC_LONG)count);
  }
  [stream close];
  if (count < 0) return nil;
  unsigned char digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256_Final(digest, &context);
  return HexString(digest, sizeof(digest));
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
  NSMutableSet<NSString *> *paths = [NSMutableSet new];
  for (NSDictionary *f in all) {
    if (![f isKindOfClass:[NSDictionary class]] || !IsSafePath(f[@"path"]) || !IsHash(f[@"hash"]) ||
        ![f[@"url"] isKindOfClass:[NSString class]] || ![NSURL URLWithString:f[@"url"]]) {
      if (error) *error = AirdropError(@"ERR_INVALID_MANIFEST", @"invalid file entry");
      return NO;
    }
    NSString *path = [f[@"path"] precomposedStringWithCanonicalMapping];
    if ([paths containsObject:path]) {
      if (error) *error = AirdropError(@"ERR_INVALID_MANIFEST", @"duplicate file path");
      return NO;
    }
    [paths addObject:path];
  }
  return YES;
}

- (BOOL)downloadUpdate:(NSDictionary *)m error:(NSError **)error {
  @synchronized(_downloadLock) {
    return [self stageUpdate:m error:error];
  }
}

- (BOOL)stageUpdate:(NSDictionary *)m error:(NSError **)error {
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
  [fm removeItemAtPath:_staging error:nil];
  if (![fm createDirectoryAtPath:_staging withIntermediateDirectories:YES attributes:nil error:nil]) {
    if (error) *error = AirdropError(@"ERR_IO", @"cannot create staging directory");
    return NO;
  }

  NSMutableArray<NSDictionary *> *files = [NSMutableArray arrayWithObject:m[@"launchAsset"]];
  [files addObjectsFromArray:m[@"assets"]];
  if (![self stageFiles:files reusable:[self reusableFiles] error:error]) {
    [fm removeItemAtPath:_staging error:nil];
    return NO;
  }
  NSMutableString *manifestText = [NSMutableString new];
  for (NSDictionary *file in files) {
    [manifestText appendFormat:@"%@\t%@\n", file[@"path"], file[@"hash"]];
  }
  NSString *manifestPath = [_staging stringByAppendingPathComponent:kManifestFile];
  // Detect an existing asset that aliases the manifest on a case-insensitive volume.
  if ([fm fileExistsAtPath:manifestPath] ||
      ![manifestText writeToFile:manifestPath atomically:YES encoding:NSUTF8StringEncoding error:nil]) {
    [fm removeItemAtPath:_staging error:nil];
    if (error) *error = AirdropError(@"ERR_IO", @"cannot write manifest");
    return NO;
  }

  @synchronized(self) {
    NSString *finalDir = [_updatesDir stringByAppendingPathComponent:updateId];
    [fm removeItemAtPath:finalDir error:nil];
    if (![fm createDirectoryAtPath:_updatesDir withIntermediateDirectories:YES attributes:nil error:nil] ||
        ![fm moveItemAtPath:_staging toPath:finalDir error:nil]) {
      [fm removeItemAtPath:_staging error:nil];
      if (error) *error = AirdropError(@"ERR_IO", @"cannot move staged update");
      return NO;
    }
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

- (BOOL)stageFiles:(NSArray<NSDictionary *> *)files
          reusable:(NSDictionary<NSString *, NSString *> *)reusable
             error:(NSError **)error {
  NSURLSessionConfiguration *config = [NSURLSessionConfiguration ephemeralSessionConfiguration];
  config.timeoutIntervalForRequest = 30;
  config.HTTPMaximumConnectionsPerHost = kMaxAssetDownloads;
  NSURLSession *session = [NSURLSession sessionWithConfiguration:config];
  NSObject *workLock = [NSObject new];
  __block NSUInteger next = 0;
  __block NSError *failure = nil;
  dispatch_apply(MIN(kMaxAssetDownloads, files.count), dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^(size_t worker) {
    NSFileManager *fm = [NSFileManager defaultManager];
    while (YES) {
      @autoreleasepool {
        NSDictionary *file;
        @synchronized(workLock) {
          if (failure || next == files.count) return;
          file = files[next++];
        }
        NSString *target = [self->_staging stringByAppendingPathComponent:file[@"path"]];
        NSError *fileError = nil;
        if (![fm createDirectoryAtPath:[target stringByDeletingLastPathComponent]
           withIntermediateDirectories:YES attributes:nil error:nil]) {
          fileError = AirdropError(@"ERR_IO", @"cannot create asset directory");
        } else {
          NSString *existing = reusable[file[@"hash"]];
          BOOL copied = existing && [Sha256OfFile(existing) isEqualToString:file[@"hash"]] &&
                        [fm copyItemAtPath:existing toPath:target error:nil];
          if (!copied) [self downloadFile:file session:session to:target error:&fileError];
        }
        if (fileError) {
          @synchronized(workLock) {
            if (!failure) failure = fileError;
          }
          return;
        }
      }
    }
  });
  [session finishTasksAndInvalidate];
  if (error && failure) *error = failure;
  return failure == nil;
}

static BOOL IsRetryableNetworkError(NSError *error) {
  if (![error.domain isEqualToString:NSURLErrorDomain]) return NO;
  switch (error.code) {
    case NSURLErrorTimedOut:
    case NSURLErrorCannotFindHost:
    case NSURLErrorCannotConnectToHost:
    case NSURLErrorNetworkConnectionLost:
    case NSURLErrorDNSLookupFailed:
    case NSURLErrorNotConnectedToInternet:
      return YES;
    default:
      return NO;
  }
}

- (BOOL)downloadFile:(NSDictionary *)f session:(NSURLSession *)session to:(NSString *)target error:(NSError **)error {
  NSString *lastError = @"download failed";
  for (int attempt = 0; attempt < 3; attempt++) {
    __block NSInteger status = 0;
    __block NSError *netError = nil;
    __block NSError *fileError = nil;
    dispatch_semaphore_t done = dispatch_semaphore_create(0);
    // NSURLSession decodes gzip and keeps the body on disk.
    [[session downloadTaskWithURL:[NSURL URLWithString:f[@"url"]]
                completionHandler:^(NSURL *location, NSURLResponse *response, NSError *err) {
                  netError = err;
                  status = [response isKindOfClass:[NSHTTPURLResponse class]] ? ((NSHTTPURLResponse *)response).statusCode : 0;
                  if (!err && status == 200 && location) {
                    NSFileManager *fm = [NSFileManager defaultManager];
                    // The temporary file expires when this completion handler returns.
                    if (![fm moveItemAtURL:location toURL:[NSURL fileURLWithPath:target] error:&fileError]) {
                      fileError = AirdropError(@"ERR_IO", fileError.localizedDescription ?: @"cannot write file");
                    }
                  }
                  dispatch_semaphore_signal(done);
                }] resume];
    dispatch_semaphore_wait(done, DISPATCH_TIME_FOREVER);
    if (fileError) {
      if (error) *error = fileError;
      return NO;
    }
    if ((status >= 500 && status < 600) || ((status == 0 || status == 200) && IsRetryableNetworkError(netError))) {
      lastError = netError.localizedDescription ?: [NSString stringWithFormat:@"HTTP %ld", (long)status];
      continue;
    }
    if (netError || status != 200) {
      lastError = netError.localizedDescription ?: [NSString stringWithFormat:@"HTTP %ld for %@", (long)status, f[@"path"]];
      break;
    }
    NSNumber *size = [[NSFileManager defaultManager] attributesOfItemAtPath:target error:nil][NSFileSize];
    if (!size) {
      if (error) *error = AirdropError(@"ERR_IO", @"cannot read downloaded file");
      return NO;
    }
    if (([f[@"size"] isKindOfClass:[NSNumber class]] && [size compare:f[@"size"]] == NSOrderedDescending) ||
        ![Sha256OfFile(target) isEqualToString:f[@"hash"]]) {
      if (error) *error = AirdropError(@"ERR_HASH_MISMATCH", [NSString stringWithFormat:@"hash mismatch for %@", f[@"path"]]);
      return NO;
    }
    return YES;
  }
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
