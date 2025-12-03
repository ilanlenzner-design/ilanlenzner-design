import React, { useState, useCallback, useEffect } from 'react';
import { describeImage, expandImage } from './services/geminiService';
import { fileToGenerativePart } from './utils/fileUtils';
import { ASPECT_RATIOS, AspectRatio } from './constants';
import { UploadIcon, SparklesIcon, ArrowPathIcon, ExclamationTriangleIcon, DownloadIcon } from './components/Icons';

type AppState = 'idle' | 'describing' | 'ready' | 'generating' | 'done' | 'error';

// 0 = Top/Left, 1 = Center, 2 = Bottom/Right
interface Alignment {
    row: 0 | 1 | 2;
    col: 0 | 1 | 2;
}

const App: React.FC = () => {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(ASPECT_RATIOS[0]);
  const [alignment, setAlignment] = useState<Alignment>({ row: 1, col: 1 });
  const [scale, setScale] = useState<number>(1.0);
  
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const handleReset = () => {
    setOriginalFile(null);
    setOriginalImagePreview(null);
    setGeneratedPrompt('');
    setAspectRatio(ASPECT_RATIOS[0]);
    setAlignment({ row: 1, col: 1 });
    setScale(1.0);
    setGeneratedImage(null);
    setErrorMessage('');
    setAppState('idle');
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setOriginalFile(file);
      setOriginalImagePreview(URL.createObjectURL(file));
      setAppState('describing');
    }
  };

  const describeOriginalImage = useCallback(async () => {
    if (!originalFile) return;

    try {
      const imagePart = await fileToGenerativePart(originalFile);
      const promptText = "Describe this image in a detailed, single paragraph, suitable for an image generation prompt. Focus on the style, subject, and composition.";
      const description = await describeImage(imagePart, promptText);
      setGeneratedPrompt(description);
      setAppState('ready');
    } catch (err) {
      console.error(err);
      setErrorMessage('Could not generate a description for the image. Please try another one.');
      setAppState('error');
    }
  }, [originalFile]);

  useEffect(() => {
    if (appState === 'describing') {
      describeOriginalImage();
    }
  }, [appState, describeOriginalImage]);


  const handleGenerateClick = async () => {
    if (!generatedPrompt || !originalImagePreview) {
      setErrorMessage('A prompt and an original image are required.');
      setAppState('error');
      return;
    }
    setAppState('generating');
    setGeneratedImage(null);

    try {
      // 1. Create a canvas with the target aspect ratio
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      const [targetW, targetH] = aspectRatio.value.split(':').map(Number);
      const MAX_DIMENSION = 1280; // Increased resolution for better quality

      // Set canvas dimensions based on aspect ratio
      if (targetW >= targetH) {
          canvas.width = MAX_DIMENSION;
          canvas.height = Math.round((MAX_DIMENSION * targetH) / targetW);
      } else {
          canvas.height = MAX_DIMENSION;
          canvas.width = Math.round((MAX_DIMENSION * targetW) / targetH);
      }

      // 2. Load the original image
      const img = new Image();
      img.src = originalImagePreview;
      await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = (err) => reject(new Error('Failed to load original image preview.'));
      });

      // 3. Calculate base scaling to 'contain' original image inside canvas
      const hRatio = canvas.width / img.width;
      const vRatio = canvas.height / img.height;
      const baseRatio = Math.min(hRatio, vRatio);

      // Apply user selected scale (from 0.5x to 1.0x relative to contain fit)
      const finalRatio = baseRatio * scale;
      
      const scaledWidth = img.width * finalRatio;
      const scaledHeight = img.height * finalRatio;

      // 4. Position image based on alignment grid
      let x = 0;
      let y = 0;

      // Horizontal
      if (alignment.col === 1) x = (canvas.width - scaledWidth) / 2;
      else if (alignment.col === 2) x = canvas.width - scaledWidth;
      // else col === 0 is x = 0

      // Vertical
      if (alignment.row === 1) y = (canvas.height - scaledHeight) / 2;
      else if (alignment.row === 2) y = canvas.height - scaledHeight;
      // else row === 0 is y = 0

      // Draw the original image onto the canvas
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

      // 5. Get the composite image as a base64 PNG
      const imageBase64 = canvas.toDataURL('image/png').split(',')[1];
      
      // 6. Create the expansion prompt
      // We use "visible image" instead of "central" because the user may have moved it.
      const expansionPrompt = `Creatively expand the visible image to fill the surrounding transparent areas. Maintain the original image's style, lighting, and subject matter. The original is about: ${generatedPrompt}`;
      
      // 7. Call the service
      const imageB64 = await expandImage(imageBase64, expansionPrompt);
      setGeneratedImage(`data:image/png;base64,${imageB64}`);
      setAppState('done');

    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to expand the image. The model might not support this type of edit. Please try again.');
      setAppState('error');
    }
  };

  const handleDownload = () => {
      if (!generatedImage) return;
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `expanded-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const renderAlignmentGrid = () => (
      <div className="grid grid-cols-3 gap-1 w-[72px] h-[72px]">
          {[0, 1, 2].flatMap(row => 
              [0, 1, 2].map(col => (
                  <button
                      key={`${row}-${col}`}
                      onClick={() => setAlignment({ row: row as 0|1|2, col: col as 0|1|2 })}
                      className={`w-full h-full rounded-sm border border-gray-600 transition-colors ${
                          alignment.row === row && alignment.col === col 
                              ? 'bg-indigo-500 border-indigo-400' 
                              : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                      title={`Align ${row === 0 ? 'Top' : row === 1 ? 'Center' : 'Bottom'} ${col === 0 ? 'Left' : col === 1 ? 'Center' : 'Right'}`}
                  />
              ))
          )}
      </div>
  );


  const renderContent = () => {
    switch (appState) {
      case 'error':
        return (
          <div className="text-center p-8 bg-red-900/20 rounded-lg border border-red-900/50">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-lg font-semibold text-white">An Error Occurred</h3>
            <p className="mt-2 text-sm text-red-300">{errorMessage}</p>
            <button
              onClick={handleReset}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              <ArrowPathIcon className="h-5 w-5"/>
              Start Over
            </button>
          </div>
        );
      case 'idle':
        return (
          <div className="relative block w-full rounded-lg border-2 border-dashed border-gray-600 p-12 text-center hover:border-gray-500 hover:bg-gray-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900">
            <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
            <span className="mt-2 block text-lg font-semibold text-gray-300">Upload an image to start</span>
            <p className="mt-1 text-sm text-gray-500">JPG, PNG, WebP supported</p>
            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Settings */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Step 1: Original & Desc */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-200">1. Source & Prompt</h2>
                    {originalImagePreview && (
                         <div className="h-10 w-10 rounded overflow-hidden border border-gray-600">
                             <img src={originalImagePreview} alt="mini" className="w-full h-full object-cover" />
                         </div>
                    )}
                 </div>
                 
                <textarea
                    value={generatedPrompt}
                    onChange={(e) => setGeneratedPrompt(e.target.value)}
                    rows={4}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 resize-none text-gray-300 placeholder-gray-600"
                    placeholder="AI is generating a description..."
                    disabled={appState === 'describing'}
                />
                 {appState === 'describing' && <p className="text-xs text-indigo-400 animate-pulse">Analyzing image...</p>}
              </div>

              {/* Step 2: Composition */}
              <div className="space-y-4 pt-4 border-t border-gray-700">
                <h2 className="text-lg font-bold text-gray-200">2. Composition</h2>
                
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-400">Aspect Ratio</label>
                    <select
                        value={aspectRatio.value}
                        onChange={(e) => setAspectRatio(ASPECT_RATIOS.find(ar => ar.value === e.target.value) || ASPECT_RATIOS[0])}
                        className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        {ASPECT_RATIOS.map(ar => <option key={ar.value} value={ar.value}>{ar.label}</option>)}
                    </select>
                </div>

                <div className="flex gap-6">
                    <div className="space-y-2">
                         <label className="block text-sm font-medium text-gray-400">Position</label>
                         {renderAlignmentGrid()}
                    </div>
                    
                    <div className="space-y-2 flex-1">
                        <label className="block text-sm font-medium text-gray-400 flex justify-between">
                            <span>Scale</span>
                            <span>{Math.round(scale * 100)}%</span>
                        </label>
                        <input 
                            type="range" 
                            min="0.3" 
                            max="1.0" 
                            step="0.05" 
                            value={scale} 
                            onChange={(e) => setScale(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <p className="text-xs text-gray-500">
                            Adjust size to create more space for expansion.
                        </p>
                    </div>
                </div>
              </div>

              <button
                onClick={handleGenerateClick}
                disabled={appState === 'describing' || appState === 'generating' || !generatedPrompt}
                className="mt-2 inline-flex w-full justify-center items-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-base font-bold text-white shadow-lg hover:bg-indigo-500 hover:shadow-indigo-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed transition-all"
              >
                {appState === 'generating' ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Expanding...
                    </>
                ) : (
                    <>
                        <SparklesIcon className="h-5 w-5" /> Expand Image
                    </>
                )}
              </button>
            </div>

            {/* Right Column: Result */}
            <div className="lg:col-span-8 flex flex-col h-full min-h-[400px]">
              <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-200">3. Result</h2>
                  {appState === 'done' && generatedImage && (
                      <button 
                        onClick={handleDownload}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-700 text-sm font-medium text-white hover:bg-gray-600 transition-colors"
                      >
                          <DownloadIcon className="w-4 h-4" /> Download
                      </button>
                  )}
              </div>
              
              <div className="flex-1 bg-gray-900/50 rounded-xl border border-gray-700 p-4 flex items-center justify-center overflow-hidden shadow-inner relative">
                <div 
                    className="relative w-full max-w-full max-h-[600px] shadow-2xl rounded-lg overflow-hidden bg-gray-800 transition-all duration-300 ease-out"
                    style={{ aspectRatio: aspectRatio.value.replace(':', ' / ') }}
                >
                    {generatedImage ? (
                        <img src={generatedImage} alt="Generated" className="w-full h-full object-cover animate-in fade-in duration-700" />
                    ) : (
                        // Preview Canvas Logic for "Pre-generation" visualization could go here, 
                        // but simpler to just show original or placeholder
                         originalImagePreview && appState !== 'generating' ? (
                             <div className="w-full h-full relative overflow-hidden">
                                {/* Rough CSS-only preview of placement */}
                                <img 
                                    src={originalImagePreview} 
                                    className="absolute object-contain opacity-60 grayscale hover:grayscale-0 transition-all"
                                    style={{
                                        width: `${scale * 100}%`,
                                        height: `${scale * 100}%`,
                                        // Approximate positioning logic for CSS preview
                                        left: alignment.col === 0 ? 0 : alignment.col === 1 ? '50%' : 'auto',
                                        right: alignment.col === 2 ? 0 : 'auto',
                                        top: alignment.row === 0 ? 0 : alignment.row === 1 ? '50%' : 'auto',
                                        bottom: alignment.row === 2 ? 0 : 'auto',
                                        transform: `translate(${alignment.col === 1 ? '-50%' : '0'}, ${alignment.row === 1 ? '-50%' : '0'})`
                                    }}
                                    alt="Preview"
                                />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-gray-900/80 backdrop-blur px-4 py-2 rounded-full text-sm text-gray-300 border border-gray-700 shadow-xl">
                                        Preview Position
                                    </div>
                                </div>
                             </div>
                         ) : null
                    )}
                    
                    {/* Loading Overlay */}
                    {appState === 'generating' && (
                        <div className="absolute inset-0 z-10 bg-gray-900/90 flex flex-col items-center justify-center text-center p-4 backdrop-blur-sm">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-indigo-900 rounded-full"></div>
                                <div className="w-16 h-16 border-4 border-indigo-500 rounded-full animate-spin border-t-transparent absolute top-0 left-0"></div>
                            </div>
                            <h3 className="mt-6 text-xl font-bold text-white">Creatively Expanding...</h3>
                            <p className="mt-2 text-gray-400 max-w-xs">The AI is hallucinating new details to fill your canvas.</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {appState !== 'generating' && !generatedImage && !originalImagePreview && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 opacity-50">
                            <SparklesIcon className="h-16 w-16 text-gray-600 mb-4"/>
                            <p className="font-medium text-gray-500">Upload an image to see preview</p>
                        </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-indigo-500/30">
      <main className="container mx-auto p-4 md:p-8 max-w-7xl">
        <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 border-b border-gray-800 pb-6">
            <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                    AI <span className="text-indigo-400">Image Expander</span>
                </h1>
                <p className="mt-1 text-gray-400 text-sm">Upload, resize, and let AI fill the rest.</p>
            </div>
            
          {appState !== 'idle' && (
             <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-full bg-gray-800 border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 shadow-sm hover:bg-gray-700 hover:text-white transition-all"
            >
              <ArrowPathIcon className="h-4 w-4"/>
              New Image
            </button>
          )}
        </header>
        
        <div className="bg-gray-900 rounded-2xl p-1 shadow-2xl border border-gray-800 ring-1 ring-white/5">
             <div className="bg-gray-800/30 rounded-xl p-4 md:p-6">
                {renderContent()}
             </div>
        </div>
      </main>
    </div>
  );
};

export default App;