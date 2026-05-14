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

interface BirthdayAlertProps {
  userName: string;
  personName: string;
  daysUntil: number;
  birthdayDate: string;
  webUrl: string;
}

export function BirthdayAlert({
  userName,
  personName,
  daysUntil,
  birthdayDate,
  webUrl,
}: BirthdayAlertProps) {
  const urgencyText = daysUntil === 0
    ? '¡Hoy es su cumpleaños!'
    : daysUntil === 1
      ? 'Su cumpleaños es mañana'
      : `Su cumpleaños es en ${daysUntil} días`;

  return (
    <Html>
      <Head />
      <Preview>🎂 {urgencyText} — {personName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={emoji}>🎂</Text>
          <Heading style={h1}>{urgencyText}</Heading>
          <Text style={text}>Hola {userName},</Text>
          <Text style={text}>
            <strong>{personName}</strong> cumple años el{' '}
            <strong>{birthdayDate}</strong>.
            {daysUntil <= 2
              ? ' Todavía estás a tiempo de enviarle un mensaje.'
              : ' Considera preparar algo especial.'}
          </Text>

          <Button style={button} href={`${webUrl}/people`}>
            Ver perfil
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
const emoji = { fontSize: '48px', margin: '0 0 16px', textAlign: 'center' as const };
const h1 = { color: '#e2e8f0', fontSize: '22px', fontWeight: '700', marginBottom: '20px' };
const text = { color: '#94a3b8', fontSize: '15px', lineHeight: '1.6', margin: '8px 0' };
const hr = { borderColor: '#2a2d3e', margin: '24px 0' };
const button = { backgroundColor: '#f472b6', color: '#ffffff', padding: '12px 24px',
  borderRadius: '8px', fontSize: '14px', fontWeight: '600', textDecoration: 'none',
  display: 'inline-block', margin: '16px 0' };
const footer = { color: '#475569', fontSize: '12px' };
const link = { color: '#818cf8' };
