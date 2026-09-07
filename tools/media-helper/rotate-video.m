#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>

static void Fail(NSString *message) {
    fprintf(stderr, "%s\n", message.UTF8String);
    exit(1);
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 4) Fail(@"Usage: rotate-video <input> <output> <-90|90>");
        NSString *inputPath = [NSString stringWithUTF8String:argv[1]];
        NSString *outputPath = [NSString stringWithUTF8String:argv[2]];
        NSInteger degrees = [[NSString stringWithUTF8String:argv[3]] integerValue];
        if (degrees != -90 && degrees != 90) Fail(@"Rotation must be -90 or 90 degrees.");

        AVURLAsset *asset = [AVURLAsset URLAssetWithURL:[NSURL fileURLWithPath:inputPath] options:nil];
        AVMutableComposition *composition = [AVMutableComposition composition];
        CMTimeRange timeRange = CMTimeRangeMake(kCMTimeZero, asset.duration);
        BOOL insertedVideo = NO;

        for (AVAssetTrack *sourceTrack in asset.tracks) {
            AVMutableCompositionTrack *targetTrack = [composition
                addMutableTrackWithMediaType:sourceTrack.mediaType
                preferredTrackID:kCMPersistentTrackID_Invalid];
            if (!targetTrack) continue;
            NSError *insertError = nil;
            if (![targetTrack insertTimeRange:timeRange ofTrack:sourceTrack atTime:kCMTimeZero error:&insertError]) {
                Fail([NSString stringWithFormat:@"Could not prepare the rotated movie: %@", insertError.localizedDescription]);
            }
            if ([sourceTrack.mediaType isEqualToString:AVMediaTypeVideo] && !insertedVideo) {
                CGFloat radians = degrees * M_PI / 180.0;
                CGAffineTransform transform = CGAffineTransformConcat(
                    sourceTrack.preferredTransform,
                    CGAffineTransformMakeRotation(radians)
                );
                CGRect bounds = CGRectApplyAffineTransform(
                    (CGRect){ .origin = CGPointZero, .size = sourceTrack.naturalSize },
                    transform
                );
                transform = CGAffineTransformConcat(
                    transform,
                    CGAffineTransformMakeTranslation(-CGRectGetMinX(bounds), -CGRectGetMinY(bounds))
                );
                targetTrack.preferredTransform = transform;
                insertedVideo = YES;
            }
        }

        if (!insertedVideo) Fail(@"The selected file has no video track.");
        AVAssetExportSession *exporter = [[AVAssetExportSession alloc]
            initWithAsset:composition
            presetName:AVAssetExportPresetPassthrough];
        if (!exporter) Fail(@"Could not create a passthrough video export.");

        exporter.outputURL = [NSURL fileURLWithPath:outputPath];
        exporter.outputFileType = [outputPath.pathExtension.lowercaseString isEqualToString:@"mov"]
            ? AVFileTypeQuickTimeMovie
            : AVFileTypeMPEG4;
        exporter.shouldOptimizeForNetworkUse = NO;
        exporter.metadata = asset.metadata;

        dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
        [exporter exportAsynchronouslyWithCompletionHandler:^{
            dispatch_semaphore_signal(semaphore);
        }];
        while (dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 200 * NSEC_PER_MSEC)) != 0) {
            printf("{\"progress\":%.4f}\n", exporter.progress);
            fflush(stdout);
        }

        if (exporter.status != AVAssetExportSessionStatusCompleted) {
            Fail(exporter.error.localizedDescription ?: @"The video export failed.");
        }
        printf("{\"progress\":1}\n");
        fflush(stdout);
    }
    return 0;
}
