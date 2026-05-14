import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface ReconnectReminderProps {
  userName: string;
  personName: string;
  daysSinceContact: number;
  actionRecommendation?: string;
  webUrl: string;
}

export function ReconnectReminder({
  userName,
  personName,
  daysSinceContact,
  actionRecommendation,
  webUrl,
}: ReconnectReminderProps) {
  return (
    <Html>
      <Head />
      <Preview>Es momento de reconectar con {personName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Momento de reconectar</Heading>
          <Text style={text}>Hola {userName},</Text>
          <Text style={text}>
            Han pasado <strong>{daysSinceContact} días</strong> desde tu último contacto
            con <strong>{personName}</strong>. Una conexión sin mantenimiento se debilita.
          </Text>

          {actionRecommendation && (
            <Text style={recommendation}>💡 {actionRecommendation}</Text>
          )}

          <Button style={button} href={`${webUrl}/people`}>
            Ver perfil de {personName}
          </Button>

          <Hr style={hr} />
          <Text style={footer}>
            SIR — Sistema de Inteligencia Relacional &nbsp;·&nbsp;
            <a href={`${webUrl}/settings`} style={link}>Gestionar notificaciones</a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#0f1117', fontFamily: 'system-ui, sans-serif' };
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' };
const h1 = { color: '#e2e8f0', fontSize: '22px', fontWeight: '700', marginBottom: '20px' };
const text = { color: '#94a3b8', fontSize: '15px', lineHeight: '1.6', margin: '8px 0' };
const recommendation = { color: '#fbbf24', fontSize: '14px', backgroundColor: '#1c1a0a',
  padding: '12px 16px', borderRadius: '8px', margin: '16px 0' };
const hr = { borderColor: '#2a2d3e', margin: '24px 0' };
const button = { backgroundColor: '#818cf8', color: '#ffffff', padding: '12px 24px',
  borderRadius: '8px', fontSize: '14px', fontWeight: '600', textDecoration: 'none',
  display: 'inline-block', margin: '16px 0' };
const footer = { color: '#475569', fontSize: '12px' };
const link = { color: '#818cf8' };
