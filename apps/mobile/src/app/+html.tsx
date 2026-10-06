import React, { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: PropsWithChildren) {
  return <html lang="vi" translate="no"><head>
    <meta charSet="utf-8" />
    <title>Clienté · Chăm sóc khách hàng</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <meta name="google" content="notranslate" />
    <ScrollViewStyleReset />
  </head><body>{children}</body></html>;
}
