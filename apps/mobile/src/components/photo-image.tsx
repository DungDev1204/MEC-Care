import React, { useEffect, useRef, useState } from 'react';
import { Image, ImageProps, Platform, View } from 'react-native';
import { photoSource } from '../lib/api';
import { currentSession } from '../lib/session';
export function PhotoImage({ id, onFailure, ...props }: Omit<ImageProps, 'source'> & { id: string; onFailure?: () => void }) {
  const [browserImage, setBrowserImage] = useState<{ id: string; uri: string } | null>(null);
  const token = currentSession()?.token;
  const failureHandler = useRef(onFailure);
  useEffect(() => { failureHandler.current = onFailure; }, [onFailure]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let alive = true; let objectUrl: string | null = null;
    const source = photoSource(id);
    fetch(source.uri, { headers: source.headers }).then(async response => { if (!response.ok) throw new Error('Không tải được ảnh'); return response.blob(); }).then(blob => {
      if (alive) { objectUrl = URL.createObjectURL(blob); setBrowserImage({ id, uri: objectUrl }); }
    }).catch(() => { if (alive) failureHandler.current?.(); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, token]);
  if (Platform.OS === 'web' && browserImage?.id !== id) return <View style={props.style} />;
  return <Image {...props} source={Platform.OS === 'web' ? { uri: browserImage?.id === id ? browserImage.uri : '' } : photoSource(id)} onError={event => { onFailure?.(); props.onError?.(event); }} />;
}
