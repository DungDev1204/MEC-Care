import React, { useEffect, useState } from 'react';
import { Alert as NativeAlert, AlertButton, Modal, Platform, Text, View } from 'react-native';
import { Button, s } from './ui';
type Dialog = { title: string; message: string; buttons: AlertButton[] };
let showWebDialog: ((dialog: Dialog) => void) | null = null;
export const appAlert = { alert(title: string, message = '', buttons: AlertButton[] = [{ text: 'Đóng' }]) {
  if (Platform.OS === 'web') showWebDialog?.({ title, message, buttons });
  else NativeAlert.alert(title, message, buttons);
} };
export function DialogHost() {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  useEffect(() => { showWebDialog = setDialog; return () => { showWebDialog = null; }; }, []);
  if (Platform.OS !== 'web') return null;
  return <Modal transparent visible={!!dialog} onRequestClose={() => setDialog(null)}>{dialog && <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
    <View style={[s.card, { width: '100%', maxWidth: 420 }]}><Text style={s.heading}>{dialog.title}</Text><Text style={s.text}>{dialog.message}</Text>
      {dialog.buttons.map((button, i) => <Button key={i} secondary={button.style === 'cancel'} title={button.text || 'Đóng'} onPress={() => { setDialog(null); button.onPress?.(); }} />)}
    </View></View>}</Modal>;
}
