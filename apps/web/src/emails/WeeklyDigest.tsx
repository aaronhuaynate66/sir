import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface TopPerson {
  name: string;
  daysSinceContact: number;
}

interface WeeklyDigestProps {
  userName: string;
  topPeople: TopPerson[];
  signalCount: number;
  weekRange: string;
  webUrl: string;
}

export function WeeklyDigest({
  userName,
  topPeople,
  signalCount,
  weekRange,
  webUrl,
}: WeeklyDigestProps) {
  return (
    <Html>
      <Head />
      <Preview>Tu resumen semanal de SIR — {weekRange}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>SIR — Resumen Semanal</Heading>
          <Text style={text}>Hola {userName},</Text>
          <Text style={text}>
            Aquí está tu resumen de actividad relacional para la semana del{' '}
            <strong>{weekRange}</strong>.
          </Text>

          {topPeople.length > 0 && (
            <Section style={section}>
              <Text style={sectionTitle}>Personas a reconectar</Text>
              {topPeople.map((p) => (
                <Text key={p.name} style={personRow}>
                  • <strong>{p.name}</strong> — hace {p.daysSinceContact} días sin contacto
                </Text>
              ))}
            </Section>
          )}

          <Hr style={hr} />

          <Section style={section}>
            <Text style={text}>
              Esta semana se capturaron <strong>{signalCount} señales sociales</strong>.
            </Text>
          </Section>

          <Button style={button} href={`${webUrl}/dashboard`}>
            Ver Dashboard
          </Button>

          <Hr style={hr} />
          <Text style={footer}>
            SIR — Sistema de Inteligencia Relacional
            <br />
            <a href={`${webUrl}/settings`} style={link}>
              Gestionar preferencias de notificación
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#0f1117', fontFamily: 'system-ui, sans-serif' };
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' };
const h1 = { color: '#e2e8f0', fontSize: '24px', fontWeight: '700', marginBottom: '24px' };
const text = { color: '#94a3b8', fontSize: '15px', lineHeight: '1.6', margin: '8px 0' };
const section = { margin: '20px 0' };
const sectionTitle = { color: '#818cf8', fontSize: '13px', fontWeight: '600',
  textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 8px' };
const personRow = { color: '#cbd5e1', fontSize: '14px', margin: '4px 0' };
const hr = { borderColor: '#2a2d3e', margin: '24px 0' };
const button = { backgroundColor: '#818cf8', color: '#ffffff', padding: '12px 24px',
  borderRadius: '8px', fontSize: '14px', fontWeight: '600', textDecoration: 'none',
  display: 'inline-block' };
const footer = { color: '#475569', fontSize: '12px', lineHeight: '1.5' };
const link = { color: '#818cf8' };
