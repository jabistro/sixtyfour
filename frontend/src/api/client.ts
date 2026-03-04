import axios from 'axios'
import { useEffect, useRef } from 'react'
import type { WsEvent } from '../types'

// In production, VITE_API_URL points to the deployed backend (e.g. https://my-backend.up.railway.app).
// In development, it's unset and the Vite proxy handles /api → localhost:8000.
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
})

export async function uploadCsv(file: File) {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/upload-csv', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data as { filename: string; rows: number; columns: string[] }
}

export async function executeWorkflow(blocks: { type: string; config: Record<string, unknown> }[]) {
  const res = await api.post('/workflows/execute', { blocks })
  return res.data as { job_id: string }
}

export async function getJob(jobId: string) {
  const res = await api.get(`/jobs/${jobId}`)
  return res.data
}

export async function cancelJob(jobId: string) {
  const res = await api.delete(`/jobs/${jobId}`)
  return res.data
}

export async function getCsvPreview(filename: string) {
  const res = await api.get(`/csv-preview/${filename}`)
  return res.data as { rows: Record<string, unknown>[]; columns: string[]; total_rows: number }
}

/** React hook — connects to WebSocket for a job and calls onEvent for each message */
export function useJobWebSocket(
  jobId: string | null,
  onEvent: (event: WsEvent) => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!jobId) return

    const wsUrl = import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL.replace(/^http/, 'ws')}/ws/${jobId}`
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/${jobId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const event: WsEvent = JSON.parse(e.data)
        if (event.type !== 'ping') {
          onEventRef.current(event)
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onerror = () => {
      onEventRef.current({ type: 'error', message: 'WebSocket connection error' })
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [jobId])
}
