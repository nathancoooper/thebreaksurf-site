#import <Foundation/Foundation.h>

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc < 2) {
            fprintf(stderr, "Usage: trash-file <path>\n");
            return 64;
        }

        NSString *path = [NSString stringWithUTF8String:argv[1]];
        NSURL *url = [NSURL fileURLWithPath:path];
        NSError *error = nil;

        if (![[NSFileManager defaultManager] trashItemAtURL:url resultingItemURL:nil error:&error]) {
            fprintf(stderr, "Could not move file to Trash: %s\n", error.localizedDescription.UTF8String);
            return 1;
        }
    }
    return 0;
}
