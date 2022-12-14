import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Logger } from '../services/logging/logger';
import { LoggingService } from '../services/logging/logging.service';

type Message = {
  application: string;
  action: string;
  data?: any;
  href?: string;
  sourceFrame?: string;
};

@Component({
  selector: 'sp-iframer',
  templateUrl: './iframer.component.html',
  styleUrls: ['./iframer.component.scss'],
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class IFramerComponent implements AfterViewInit {
  url?: URL;
  trustedUrl?: SafeResourceUrl;
  unsupportedHost = '';
  isVisible = true; // It is important that the dialog is visible at the start, even if no iframe. (width/heigh = 0px)
  focusClass = '';
  drawerClass = '';
  width = '0px';
  height = '0px';
  loading = false;
  headerText: string = '';
  headerIconUrlBase = 'https://www.google.com/s2/favicons?domain=';
  headerIconUrl: string = '';
  @ViewChild('iframe') iframe!: ElementRef<HTMLIFrameElement>;
  logger: Logger;
  navStack: URL[] = [];
  showBackButton = false;

  constructor(
    private sanitizer: DomSanitizer,
    private ngZone: NgZone,
    loggingService: LoggingService
  ) {
    this.logger = loggingService.getLogger('sp-iframer');
  }

  ngAfterViewInit() {
    this.isVisible = false; // Hide the tiny dialog that was shown during init.
    this.listenForCspError();
    this.listenForWindowMessages();
  }

  listenForCspError() {
    document.addEventListener('securitypolicyviolation', (e) => {
      if (window.name !== 'iframer') {
        return;
      }
      this.logger.error('CSP error', e, e.blockedURI);
      this.unsupportedHost = window.location.origin;
      // TODO: send a message to background script to open url, there might not be a popup running.
      setTimeout(() => {
        this.isVisible = false;
      }, 1000);
    });
  }

  listenForWindowMessages() {
    window.addEventListener(
      'message',
      (event) => {
        if (event.origin !== window.location.origin) {
          this.logger.debug(
            'Ignoring message from different origin',
            event.origin,
            event.data
          );
          return;
        }

        if (event.data.application !== 'better-previews') {
          this.logger.debug(
            'Ignoring origin messsage not initiated by Better Previews'
          );
          return;
        }

        this.logger.log('#WindowMessage: ', event);
        this.ngZone.run(() => {
          this.handleMessage(event.data);
        });
      },
      false
    );
  }

  handleMessage(message: Message) {
    // Extract the url from the message.
    let urlStr;
    if (message.action === 'copy') {
      navigator.clipboard.writeText(message.data);
      return;
    } else if (message.action === 'preview') {
      urlStr = message.data;
    } else if (message.action === 'search') {
      urlStr = 'https://google.com/search?igu=1&q=' + message.data;
    } else if (message.action === 'load') {
      if (message.sourceFrame === 'iframer') {
        this.headerText = message.data.title;
        this.headerIconUrl =
          this.headerIconUrlBase + new URL(message.href!).hostname;
      }
    } else if (message.action === 'navigate') {
      urlStr = message.href;
    } else {
      this.logger.warn('Unhandled action', message);
    }

    // Ensure it is valid.
    if (!urlStr) {
      return;
    }
    let newUrl;
    try {
      newUrl = new URL(urlStr);
    } catch (e) {
      this.logger.error(e);
      return;
    }

    // Move the old URL to backstack.
    if (this.url && this.url.href !== newUrl.href) {
      this.navStack.push(this.url);
      this.showBackButton = true;
    }

    // Preview new URL.
    this.previewUrl(newUrl);
  }

  previewUrl(url: URL) {
    this.url = url;
    this.trustedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.url.href
    );
    if (this.unsupportedHost) {
      this.logger.warn('Unsupported host: ', this.unsupportedHost);
      // TODO: Display button to open in new tab.
      this.isVisible = true;
      return;
    }

    this.headerText = this.url.hostname;
    this.headerIconUrl = this.headerIconUrlBase + this.url.hostname;
    this.width = '50vw';
    this.height = '70vh';
    this.isVisible = true;
    this.loading = true;
    this.focusClass = '';
    this.drawerClass = '';
  }

  onResizeStart(e: any) {
    this.logger.debug('#onResizeStart: ', e);
  }
  onResizeEnd(e: any) {
    this.logger.debug('#onResizeEnd: ', e);
  }
  onShow(e: any) {
    this.logger.debug('#onShow: ', e);
  }
  onHide(e: any) {
    this.logger.debug('#onHide: ', e);
  }
  onDragEnd(e: any) {
    this.logger.debug('#onDragEnd: ', e);
  }
  onOpenInNewTab() {
    this.logger.log('#onOpenInNewTab: url', this.url);
    window.open(this.url, '_blank');
  }
  onBackNav() {
    let url = this.navStack.pop();
    if (url) {
      this.previewUrl(url);
    }
    this.showBackButton = this.navStack.length > 0;
  }
  onVisibleChange(isVisible: boolean) {
    this.isVisible = isVisible;

    // TODO: Clear navigation stack on close preview.
    // Prevents showing nav button due to previous open URL.
  }
  onMouseOver(unused: MouseEvent) {
    this.focusClass = '';
    this.drawerClass = '';
  }
  onMouseOut(e: MouseEvent) {
    // Ignore mouseout when it's from the right corner.
    const viewportWidth = window?.visualViewport?.width ?? 0;
    if (viewportWidth - e.clientX < 100) {
      return;
    }
    /*
     * TODO: Disable hiding the panel for easier development.
     * this.focusClass = 'transparent';
     * this.drawerClass = 'parked';
     */
  }

  onLoaded(e: any) {
    this.logger.debug('#onLoaded', e);
    this.loading = false;
    /*
     * While this does not tell us which URL is loaded,
     * It can be used to:
     * 1. Measure time taken to load the page.
     * 2. End any running 'loading' animation.
     * 3. Inform that "Open in New Tab" button may not open the expected URL.
     * 4. Display a backward navigation button.
     */
  }

  /*
   *- Information you'd like to show (remember, even chrome couldn't fit all of them in)
   *- Window controls: Close, Maximize, Pull-aside (style by OS?) Remember windows vs mac is 74:14
   *- Tab actions: Copy-page address, Reload page, Navigate forward/back
   *- Tab data: Page favicon, Page title, hostname
   *- Checkout opera for inspiration.
   */
}
