import {
  ApplicationRef,
  APP_INITIALIZER,
  DoBootstrap,
  ErrorHandler,
  Injector,
  NgModule,
} from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { createCustomElement } from '@angular/elements';
import { APP_BASE_HREF } from '@angular/common';

import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { PreviewModule } from './preview/preview.module';
import { CardModule } from 'primeng/card';
import { CarouselModule } from 'primeng/carousel';
import * as Sentry from '@sentry/angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { Router } from '@angular/router';
import { IFramerComponent } from './iframer/iframer.component';
import { environment } from 'src/environments/environment';

let sentryProviders: any[] = [];
if (environment.production) {
  sentryProviders = [
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({
        showDialog: true,
      }),
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
  ];
}
@NgModule({
  declarations: [AppComponent, IFramerComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    ButtonModule,
    CardModule,
    CarouselModule,
    DropdownModule,
    PreviewModule,
    AppRoutingModule,
    FormsModule,
  ],
  providers: [
    {
      provide: APP_BASE_HREF,
      useValue: '/',
    },
    ...sentryProviders,
  ],
})
export class AppModule implements DoBootstrap {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private injector: Injector) {}
  ngDoBootstrap(appRef: ApplicationRef) {
    if (document.querySelector('sp-root')) {
      appRef.bootstrap(AppComponent);
    }

    const el = createCustomElement(IFramerComponent, {
      injector: this.injector,
    });
    customElements.define('sp-iframer', el);
  }
}
