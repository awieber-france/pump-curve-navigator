import React, { useState, useRef, useEffect } from 'react'

type Point = { x: number; y: number }
type CalibratedPoint = { x: number; y: number; value: number; unit: string }

type WizardData = {
  headUnit: string;
  flowUnit: string;
  originPoint: Point | null;
  originHeadValue: string;
  originFlowValue: string;
  flowAxis: 'x' | 'y';
  flowRefPoint: Point | null;
  flowRefValue: string;
  headRefPoint: Point | null;
  headRefValue: string;
}

const HEAD_UNITS = ['meters', 'feet']
const FLOW_VOL_UNITS = ['m3', 'gal', 'L', 'mL', 'ft3']
const FLOW_TIME_UNITS = ['s', 'min', 'h']

const CONVERSION_FACTORS = {
  head: {
    meters: 1,
    feet: 0.3048,
  },
  flowVol: {
    m3: 1,
    ft3: 0.0283168,
    L: 0.001,
    mL: 0.000001,
    gal: 0.00378541,
  },
  flowTime: {
    s: 1,
    min: 60,
    h: 3600,
  },
}

const convertHead = (value: number, from: string, to: string) => {
  const baseValue = value * (CONVERSION_FACTORS.head[from] || 1)
  return baseValue / (CONVERSION_FACTORS.head[to] || 1)
}

const convertFlow = (value: number, fromUnit: string, toUnit: string) => {
  const [fromVol, fromTime] = fromUnit.split('/')
  const [toVol, toTime] = toUnit.split('/')
  
  const volFrom = CONVERSION_FACTORS.flowVol[fromVol] || 1
  const timeFrom = CONVERSION_FACTORS.flowTime[fromTime] || 1
  const volTo = CONVERSION_FACTORS.flowVol[toVol] || 1
  const timeTo = CONVERSION_FACTORS.flowTime[toTime] || 1
  
  const baseValue = value * (volFrom / timeFrom)
  return baseValue / (volTo / timeTo)
}

type Mode = 'view' | 'analyze'

function App() {
  const [image, setImage] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<Mode>('view')
  
  // Calibration State
  const [origin, setOrigin] = useState<Point | null>(null)
  const [flowRef, setFlowRef] = useState<CalibratedPoint | null>(null)
  const [headRef, setHeadRef] = useState<CalibratedPoint | null>(null)
  const [flowAxis, setFlowAxis] = useState<'x' | 'y'>('x')
  const [originFlowValue, setOriginFlowValue] = useState(0)
  const [originHeadValue, setOriginHeadValue] = useState(0)
  
  // Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardPos, setWizardPos] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [wizardData, setWizardData] = useState<WizardData>({
    headUnit: HEAD_UNITS[0],
    flowUnit: `${FLOW_VOL_UNITS[0]}/${FLOW_TIME_UNITS[0]}`,
    originPoint: null,
    originHeadValue: '0',
    originFlowValue: '0',
    flowAxis: 'x',
    flowRefPoint: null,
    flowRefValue: '0',
    headRefPoint: null,
    headRefValue: '0',
  })
  const [wizardSnapshot, setWizardSnapshot] = useState<WizardData | null>(null)
  
  // Conversion State
  const [targetHeadUnit, setTargetHeadUnit] = useState(HEAD_UNITS[0])
  const [targetFlowVolUnit, setTargetFlowVolUnit] = useState(FLOW_VOL_UNITS[0])
  const [targetFlowTimeUnit, setTargetFlowTimeUnit] = useState(FLOW_TIME_UNITS[0])
  
  // Analysis State
  const [analysisPoints, setAnalysisPoints] = useState<{ point: Point; result: { flow: number; head: number } }[]>([])
  const [hoverResult, setHoverResult] = useState<{ flow: number; head: number } | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  const [saveName, setSaveName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savedCalibrations, setSavedCalibrations] = useState<any[]>([])

  // API Integration
  const API_BASE = 'http://localhost:3001/api'

  const fetchCalibrations = async () => {
    try {
      const res = await fetch(`${API_BASE}/calibrations`)
      const data = await res.json()
      setSavedCalibrations(data)
    } catch (err) {
      console.error('Failed to fetch calibrations:', err)
    }
  }

  const saveCalibration = async () => {
    if (!saveName) return
    setIsSaving(true)
    try {
      const res = await fetch(`${API_BASE}/calibrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName,
          origin,
          flowRef,
          headRef,
        }),
      })
      if (res.ok) {
        setSaveName('')
        await fetchCalibrations()
      }
    } catch (err) {
      console.error('Failed to save calibration:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const loadCalibration = (cal: any) => {
    setOrigin(cal.origin || cal.flowOrigin) // Backward compatibility if needed, but let's stick to origin
    setFlowRef(cal.flowRef)
    setHeadRef(cal.headRef)
    setMode('view')
  }

  const handleWizardMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - wizardPos.x,
      y: e.clientY - wizardPos.y
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setWizardPos({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        })
      }
    }
    const handleMouseUp = () => {
      setIsDragging(false)
    }
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const deleteCalibration = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/calibrations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchCalibrations()
      }
    } catch (err) {
      console.error('Failed to delete calibration:', err)
    }
  }

  useEffect(() => {
    fetchCalibrations()
  }, [])

  useEffect(() => {
    if (isWizardOpen && wizardPos.x === 0 && wizardPos.y === 0) {
      setWizardPos({
        x: window.innerWidth / 2 - 200, // approx half of max-w-md
        y: window.innerHeight / 2 - 200
      })
    }
  }, [isWizardOpen])

  // Modal State for Reference Value Entry

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number; type: 'flow' | 'head' } | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [selectedHeadUnit, setSelectedHeadUnit] = useState(HEAD_UNITS[0])
  const [selectedFlowVolUnit, setSelectedFlowVolUnit] = useState(FLOW_VOL_UNITS[0])
  const [selectedFlowTimeUnit, setSelectedFlowTimeUnit] = useState(FLOW_TIME_UNITS[0])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImage(e.target?.result as string)
        // Reset calibration when new image is loaded
        setOrigin(null)
        setFlowRef(null)
        setHeadRef(null)
        setAnalysisPoints([])
        setMode('view')
      }
      reader.readAsDataURL(file)
    }
  }

  const calculateValue = (point: Point) => {
    if (!origin || !flowRef || !headRef) return null

    let flow, head;
    if (flowAxis === 'x') {
      const flowScale = (flowRef.value - originFlowValue) / (flowRef.x - origin.x)
      flow = originFlowValue + (point.x - origin.x) * flowScale
      const headScale = (headRef.value - originHeadValue) / (headRef.y - origin.y)
      head = originHeadValue + (point.y - origin.y) * headScale
    } else {
      const flowScale = (flowRef.value - originFlowValue) / (flowRef.y - origin.y)
      flow = originFlowValue + (point.y - origin.y) * flowScale
      const headScale = (headRef.value - originHeadValue) / (headRef.x - origin.x)
      head = originHeadValue + (point.x - origin.x) * headScale
    }

    return { flow, head }
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    const x = (event.clientX - rect.left) * scaleX
    const y = (event.clientY - rect.top) * scaleY

    if (isWizardOpen) {
      setWizardData(prev => {
        if (wizardStep === 3) return { ...prev, originPoint: { x, y } }
        if (wizardStep === 4) return { ...prev, flowRefPoint: { x, y } }
        if (wizardStep === 5) return { ...prev, headRefPoint: { x, y } }
        return prev
      })
      return
    }

    if (mode === 'view') return

    if (mode === 'analyze') {
      const res = calculateValue({ x, y })
      setAnalysisPoints(prev => [...prev, { point: { x, y }, result: res! }])
    }
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    const x = (event.clientX - rect.left) * scaleX
    const y = (event.clientY - rect.top) * scaleY

    setMousePos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    const res = calculateValue({ x, y })
    setHoverResult(res)
  }

  const handleMouseLeave = () => {
    setHoverResult(null)
    setMousePos(null)
  }

  const handleSaveReference = () => {
    if (!pendingPoint) return
    const val = parseFloat(inputValue)
    if (isNaN(val)) return

    if (pendingPoint.type === 'flow') {
      setFlowRef({ 
        x: pendingPoint.x, 
        y: pendingPoint.y, 
        value: val, 
        unit: `${selectedFlowVolUnit}/${selectedFlowTimeUnit}` 
      })
    } else {
      setHeadRef({ 
        x: pendingPoint.x, 
        y: pendingPoint.y, 
        value: val, 
        unit: selectedHeadUnit 
      })
    }
    setIsModalOpen(false)
    setPendingPoint(null)
  }

  const saveWizard = () => {
    if (!wizardData.originPoint || !wizardData.flowRefPoint || !wizardData.headRefPoint) return
    
    setOrigin(wizardData.originPoint)
    setFlowAxis(wizardData.flowAxis)
    setOriginFlowValue(parseFloat(wizardData.originFlowValue) || 0)
    setOriginHeadValue(parseFloat(wizardData.originHeadValue) || 0)
    
    setFlowRef({
      x: wizardData.flowRefPoint.x,
      y: wizardData.flowRefPoint.y,
      value: parseFloat(wizardData.flowRefValue) || 0,
      unit: wizardData.flowUnit
    })
    
    setHeadRef({
      x: wizardData.headRefPoint.x,
      y: wizardData.headRefPoint.y,
      value: parseFloat(wizardData.headRefValue) || 0,
      unit: wizardData.headUnit
    })
    
    setIsWizardOpen(false)
    setMode('view')
  }

  const resetCalibration = () => {
    setOrigin(null)
    setFlowRef(null)
    setHeadRef(null)
    setAnalysisPoints([])
  }

  const handleConvertUnits = () => {
    const oldFlowUnit = flowRef?.unit
    const oldHeadUnit = headRef?.unit
    const newFlowUnit = `${targetFlowVolUnit}/${targetFlowTimeUnit}`
    const newHeadUnit = targetHeadUnit

    if (flowRef) {
      const newValue = convertFlow(flowRef.value, oldFlowUnit!, newFlowUnit)
      setFlowRef({ ...flowRef, value: newValue, unit: newFlowUnit })
    }
    if (headRef) {
      const newValue = convertHead(headRef.value, oldHeadUnit!, newHeadUnit)
      setHeadRef({ ...headRef, value: newValue, unit: newHeadUnit })
    }

    setAnalysisPoints(prev => prev.map(ap => ({
      ...ap,
      result: {
        flow: oldFlowUnit ? convertFlow(ap.result.flow, oldFlowUnit, newFlowUnit) : ap.result.flow,
        head: oldHeadUnit ? convertHead(ap.result.head, oldHeadUnit, newHeadUnit) : ap.result.head
      }
    })))
  }

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const img = new Image()
      img.onload = () => {
        const maxWidth = 1000
        const maxHeight = 800
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          const ratio = maxWidth / width
          width = maxWidth
          height = height * ratio
        }
        if (height > maxHeight) {
          const ratio = maxHeight / height
          height = maxHeight
          width = width * ratio
        }

        canvas.width = width
        canvas.height = height
        
        draw(img)
      }
      img.src = image
    }
  }, [image, mode, origin, flowRef, headRef, analysisPoints])

  const draw = (img: HTMLImageElement) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Draw Markers
    const drawMarker = (p: Point | null, color: string, label: string, textColor: string = 'white') => {
      if (!p) return
      ctx.fillStyle = color
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      
      ctx.fillStyle = textColor
      ctx.font = '12px monospace'
      ctx.fillText(label, p.x + 10, p.y - 10)
    }

    drawMarker(origin, '#ef4444', 'Origin')
    drawMarker(flowRef, '#3b82f6', 'Flow Ref')
    drawMarker(headRef, '#f59e0b', 'Head Ref')
    
    if (isWizardOpen) {
      drawMarker(wizardData.originPoint, '#ef4444', 'Origin (Temp)')
      drawMarker(wizardData.flowRefPoint, '#3b82f6', 'Flow Ref (Temp)')
      drawMarker(wizardData.headRefPoint, '#f59e0b', 'Head Ref (Temp)')
    }

    analysisPoints.forEach((ap, index) => {
      drawMarker(ap.point, '#a855f7', `Point ${index + 1}`, 'red')
    })
  }


  // Modified useEffect to handle redraws because img.onload is asynchronous

  const viewModes: { id: Mode; label: string }[] = [
    { id: 'view', label: 'View' },
    { id: 'analyze', label: 'Analyze' },
  ]
  const modes = viewModes

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 font-sans">
      {/* Wizard Overlay */}
      {isWizardOpen && (
        <div 
          className="fixed z-50 pointer-events-none" 
          style={{ left: wizardPos.x, top: wizardPos.y }}
        >
          <div className="bg-zinc-800 border border-zinc-700 p-6 rounded-lg shadow-2xl w-full max-w-md space-y-6 pointer-events-auto">
            <div 
              className="flex justify-between items-center border-b border-zinc-700 pb-3 cursor-grab active:cursor-grabbing"
              onMouseDown={handleWizardMouseDown}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-blue-400 uppercase font-bold">Step {wizardStep} / 5</span>
                <h3 className="text-sm font-mono uppercase text-zinc-300">Calibration Wizard</h3>
              </div>
              <button 
                onClick={() => {
                  setIsWizardOpen(false)
                  setWizardData(wizardSnapshot || wizardData)
                }} 
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="min-h-[200px] space-y-4">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 font-mono">Select the units for Head measurement:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {HEAD_UNITS.map(u => (
                      <button 
                        key={u}
                        onClick={() => setWizardData(prev => ({ ...prev, headUnit: u }))}
                        className={`p-2 rounded text-xs font-mono transition-all border ${
                          wizardData.headUnit === u ? 'bg-blue-600 border-blue-400 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 font-mono">Select the units for Flow measurement:</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase">Volume</label>
                      <select 
                        value={wizardData.flowUnit.split('/')[0]}
                        onChange={(e) => {
                          const vol = e.target.value
                          const time = wizardData.flowUnit.split('/')[1]
                          setWizardData(prev => ({ ...prev, flowUnit: `${vol}/${time}` }))
                        }}
                        className="w-full bg-zinc-900 border border-zinc-700 p-2 rounded text-xs font-mono text-white outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {FLOW_VOL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase">Time</label>
                      <select 
                        value={wizardData.flowUnit.split('/')[1]}
                        onChange={(e) => {
                          const time = e.target.value
                          const vol = wizardData.flowUnit.split('/')[0]
                          setWizardData(prev => ({ ...prev, flowUnit: `${vol}/${time}` }))
                        }}
                        className="w-full bg-zinc-900 border border-zinc-700 p-2 rounded text-xs font-mono text-white outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {FLOW_TIME_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 font-mono">
                    <span className="text-blue-400 font-bold">Action:</span> Click on the canvas to set the <span className="text-red-400">Global Origin</span>.
                  </p>
                  <div className="flex items-center justify-between p-2 bg-zinc-900 border border-zinc-700 rounded">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Selected Point</span>
                    <span className="text-xs font-mono text-white">
                      {wizardData.originPoint ? `${wizardData.originPoint.x.toFixed(0)}, ${wizardData.originPoint.y.toFixed(0)}` : 'Not Selected'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase">Origin Flow</label>
                      <input 
                        type="text" 
                        value={wizardData.originFlowValue}
                        onChange={(e) => setWizardData(prev => ({ ...prev, originFlowValue: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-700 p-2 rounded text-xs font-mono text-white outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase">Origin Head</label>
                      <input 
                        type="text" 
                        value={wizardData.originHeadValue}
                        onChange={(e) => setWizardData(prev => ({ ...prev, originHeadValue: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-700 p-2 rounded text-xs font-mono text-white outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 font-mono">
                    <span className="text-blue-400 font-bold">Action:</span> Click on the canvas to set the <span className="text-blue-400">Flow Reference</span>.
                  </p>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase">Flow Axis</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['x', 'y'] as const).map(axis => (
                        <button 
                          key={axis}
                          onClick={() => setWizardData(prev => ({ ...prev, flowAxis: axis }))}
                          className={`p-2 rounded text-xs font-mono transition-all border ${
                            wizardData.flowAxis === axis ? 'bg-blue-600 border-blue-400 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                          }`}
                        >
                          Axis {axis.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-zinc-900 border border-zinc-700 rounded">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Selected Point</span>
                    <span className="text-xs font-mono text-white">
                      {wizardData.flowRefPoint ? `${wizardData.flowRefPoint.x.toFixed(0)}, ${wizardData.flowRefPoint.y.toFixed(0)}` : 'Not Selected'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase">Flow Reference Value</label>
                    <input 
                      type="text" 
                      value={wizardData.flowRefValue}
                      onChange={(e) => setWizardData(prev => ({ ...prev, flowRefValue: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 p-2 rounded text-xs font-mono text-white outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 font-mono">
                    <span className="text-blue-400 font-bold">Action:</span> Click on the canvas to set the <span className="text-amber-400">Head Reference</span>.
                  </p>
                  <div className="p-2 bg-zinc-900 border border-zinc-700 rounded text-center">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Head Axis: 
                      <span className="text-white ml-1">{wizardData.flowAxis === 'x' ? 'Y' : 'X'}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-zinc-900 border border-zinc-700 rounded">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Selected Point</span>
                    <span className="text-xs font-mono text-white">
                      {wizardData.headRefPoint ? `${wizardData.headRefPoint.x.toFixed(0)}, ${wizardData.headRefPoint.y.toFixed(0)}` : 'Not Selected'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase">Head Reference Value</label>
                    <input 
                      type="text" 
                      value={wizardData.headRefValue}
                      onChange={(e) => setWizardData(prev => ({ ...prev, headRefValue: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 p-2 rounded text-xs font-mono text-white outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-zinc-700">
              <button 
                onClick={() => setWizardStep(prev => Math.max(1, prev - 1))}
                disabled={wizardStep === 1}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono rounded transition-colors"
              >
                Back
              </button>
              {wizardStep < 5 ? (
                <button 
                  onClick={() => setWizardStep(prev => prev + 1)}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-mono rounded transition-colors shadow-sm"
                >
                  Next
                </button>
              ) : (
                <button 
                  onClick={saveWizard}
                  disabled={!wizardData.originPoint || !wizardData.flowRefPoint || !wizardData.headRefPoint}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-600 text-xs font-mono rounded transition-colors shadow-sm"
                >
                  Apply Calibration
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-zinc-800 border-b border-zinc-700 p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center font-bold text-white">PC</div>
            <h1 className="text-xl font-semibold tracking-tight uppercase">Pump Curve Navigator</h1>
          </div>
          <div className="text-xs text-zinc-400 font-mono">
            v1.0.0-alpha | System Ready
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        {/* Control Panel */}
        <section className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 py-10 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4 flex-1">
              <div className="flex flex-col gap-4">
                 <div className="text-left">
                  <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Data Acquisition</h2>
                  <p className="text-xs text-zinc-500">Upload a pump performance curve image for analysis</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center gap-2 w-fit">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Image
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                  {image && (
                    <button 
                      onClick={() => setImage(null)} 
                      className="text-zinc-400 hover:text-zinc-200 text-xs underline underline-offset-4"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-700">
                <div className="flex flex-col gap-3 mb-4">
                  <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Analysis & Calibration</h2>
                  <div className="flex gap-2 w-fit">
                    <button 
                      onClick={() => {
                        setWizardSnapshot({ ...wizardData })
                        setIsWizardOpen(true)
                        setWizardStep(1)
                      }}
                      className="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded border border-blue-900/50 hover:bg-blue-900/30"
                    >
                      Start Wizard
                    </button>
                    <button 
                      onClick={resetCalibration}
                      className="text-[10px] uppercase font-bold text-zinc-400 hover:text-red-400 transition-colors px-2 py-1 rounded border border-zinc-700 hover:border-red-900/50"
                    >
                      Reset All
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-6 mt-4 text-xs font-mono">
                  <div className="flex flex-col gap-1">
                    <span className="text-zinc-500 uppercase text-[10px]">Origin Flow</span>
                    <span className="text-white">
                      {originFlowValue.toFixed(2)} {flowRef?.unit || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-zinc-500 uppercase text-[10px]">Origin Head</span>
                    <span className="text-white">
                      {originHeadValue.toFixed(2)} {headRef?.unit || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-zinc-500 uppercase text-[10px]">Flow Ref</span>
                    <span className={flowRef ? 'text-white' : 'text-red-500'}>
                      {flowRef ? `${flowRef.value.toFixed(2)} ${flowRef.unit}` : 'None'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-zinc-500 uppercase text-[10px]">Head Ref</span>
                    <span className={headRef ? 'text-white' : 'text-red-500'}>
                      {headRef ? `${headRef.value.toFixed(2)} ${headRef.unit}` : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-700">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Calibration Store</h2>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={saveName} 
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="Profile name..." 
                      className="flex-1 bg-zinc-900 border border-zinc-700 p-2 rounded text-xs font-mono text-white outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button 
                      onClick={saveCalibration} 
                      disabled={isSaving || !saveName}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 text-white px-3 py-2 rounded text-xs font-medium transition-colors shadow-sm"
                    >
                      {isSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {savedCalibrations.map((cal) => (
                      <div key={cal.id} className="flex items-center justify-between bg-zinc-700/50 p-2 rounded border border-zinc-600 group hover:border-zinc-400 transition-colors">
                        <span className="text-xs font-mono truncate max-w-[100px]">{cal.name}</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => loadCalibration(cal)} 
                            className="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300"
                          >
                            Load
                          </button>
                          <button 
                            onClick={() => deleteCalibration(cal.id)} 
                            className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300"
                          >
                            Del
                          </button>
                        </div>
                      </div>
                    ))}
                    {savedCalibrations.length === 0 && (
                      <p className="text-xs text-zinc-500 font-mono italic">No saved profiles found.</p>
                    )}
                  </div>
                </div>
                <div className="pt-4 border-t border-zinc-700">
                  <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Data Sampling</h2>
                  <div className="flex flex-wrap gap-2">
                    {modes.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                          mode === m.id 
                          ? 'bg-blue-600 text-white shadow-inner ring-1 ring-blue-400' 
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* Display Area */}
        <section className="grid grid-cols-1 gap-6">
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-zinc-700/50 px-4 py-2 border-b border-zinc-700 flex justify-between items-center">
              <span className="text-xs font-mono text-zinc-300 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                IMAGE VIEWPORT
              </span>
              {image && (
                <div className="flex gap-4">
                    <span className="text-xs font-mono text-zinc-400">MODE: {mode.toUpperCase()}</span>
                    <span className="text-xs font-mono text-zinc-400">RENDER: CANVAS_2D</span>
                </div>
              )}
            </div>
            <div className="p-8 flex justify-center items-center min-h-[400px] bg-zinc-900/50">
              {!image ? (
                <div className="text-center space-y-3 opacity-40">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-mono uppercase">No curve loaded</p>
                </div>
              ) : (
                <div className="relative border border-zinc-700 bg-black shadow-2xl cursor-crosshair">
                  <canvas 
                    ref={canvasRef} 
                    onClick={handleCanvasClick}
                                         onMouseMove={handleMouseMove}
                     onMouseLeave={handleMouseLeave}
                    className="max-w-full max-h-screen"
                  />
                  {hoverResult && mousePos && (
                    <div 
                      className="absolute pointer-events-none bg-zinc-800 border border-zinc-600 p-2 rounded shadow-lg z-10 flex flex-col gap-1"
                      style={{ 
                        left: mousePos.x + 15, 
                        top: mousePos.y + 15 
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase">Flow:</span>
                        <span className="text-xs font-mono text-white font-bold">{hoverResult.flow.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase">Head:</span>
                        <span className="text-xs font-mono text-white font-bold">{hoverResult.head.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {analysisPoints.length > 0 && (
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden shadow-sm mt-6">
              <div className="bg-zinc-700/50 px-4 py-2 border-b border-zinc-700 flex justify-between items-center">
                <span className="text-xs font-mono text-zinc-300 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  ANALYSIS RESULTS
                </span>
                <button 
                  onClick={() => setAnalysisPoints([])} 
                  className="text-[10px] uppercase font-bold text-zinc-400 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-900/50 text-zinc-500 uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-2 border-b border-zinc-700">Point</th>
                      <th className="px-4 py-2 border-b border-zinc-700">Flow</th>
                      <th className="px-4 py-2 border-b border-zinc-700">Head</th>
                      <th className="px-4 py-2 border-b border-zinc-700">Coords</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisPoints.map((ap, i) => (
                      <tr key={i} className="border-b border-zinc-700/50 hover:bg-zinc-700/30 transition-colors">
                        <td className="px-4 py-2 text-zinc-400">{i + 1}</td>
                        <td className="px-4 py-2 text-white font-bold">{ap.result.flow.toFixed(2)} {flowRef?.unit || '-'}</td>
                        <td className="px-4 py-2 text-white font-bold">{ap.result.head.toFixed(2)} {headRef?.unit || '-'}</td>
                        <td className="px-4 py-2 text-zinc-500">{ap.point.x.toFixed(0)}, {ap.point.y.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
