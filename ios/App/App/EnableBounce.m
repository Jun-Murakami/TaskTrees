//
//  EnableBounce.m
//  App
//
//  Created by 村上 純 on 2024/04/06.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@implementation UIScrollView (NoBounce)
- (void)didMoveToWindow {
    [super didMoveToWindow];
    self.bounces = YES;
}
@end
