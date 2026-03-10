"use client";

import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const firebaseConfig = {
  apiKey: "AIzaSyABcguF-gLkoJX2v1S7Q_bPNQaTQQFqfLM",
  authDomain: "myfitnesstracker-b7f16.firebaseapp.com",
  projectId: "myfitnesstracker-b7f16",
  storageBucket: "myfitnesstracker-b7f16.firebasestorage.app",
  messagingSenderId: "187825503361",
  appId: "1:187825503361:web:41a1e79e41a93093526180",
  measurementId: "G-7B0BNNQXEB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 活潑版拖曳項目 ---
function SortableFoodItem({ food, onSelect, onEdit, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: food.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 mb-2 group">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 text-slate-300 hover:text-indigo-400 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8h16M4 16h16"></path></svg>
      </div>

      <button onClick={() => onSelect(food)} className="flex-1 text-left p-4 bg-white border-2 border-slate-50 rounded-2xl shadow-sm hover:border-indigo-100 transition-all active:scale-[0.98]">
        <div className="flex justify-between items-center mb-1">
          <span className="font-black text-slate-700 text-base">✨ {food.name}</span>
          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-black uppercase">{food.servingSize}g</span>
        </div>
        <div className="flex gap-3 items-center">
          <span className="text-[10px] font-bold text-indigo-500">🍖 {food.protein}g</span>
          <span className="text-[10px] font-bold text-orange-400">⚡ {food.calories}kcal</span>
          <span className="text-[10px] font-bold text-emerald-500">🥗 {food.fiber}g</span>
        </div>
      </button>

      <div className="flex flex-col gap-1">
        <button onClick={() => onEdit(food)} className="bg-indigo-50 text-indigo-400 p-2.5 rounded-xl hover:bg-indigo-500 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [dbLoading, setDbLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [history, setHistory] = useState<any>({}); 
  const [myFoods, setMyFoods] = useState<any[]>([]);
  const [selectedFood, setSelectedFood] = useState<any>(null); 
  const [showManual, setShowManual] = useState(false);
  const [weight, setWeight] = useState('100');
  const [editingFoodId, setEditingFoodId] = useState<number | null>(null);
  const [manualFood, setManualFood] = useState({ 
    name: '', calories: '', protein: '', carbs: '', fiber: '', servingSize: '100', actualEat: '100' 
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "trackers", "yi-ching-data"), (docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        setHistory(cloudData.history || {});
        setMyFoods(cloudData.myFoods || []);
      }
      setDbLoading(false);
    });
    return () => unsub();
  }, []);

  const syncToCloud = async (newHistory: any, newMyFoods?: any[]) => {
    await setDoc(doc(db, "trackers", "yi-ching-data"), { 
      history: newHistory,
      myFoods: newMyFoods || myFoods
    }, { merge: true });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = myFoods.findIndex((f) => f.id === active.id);
      const newIndex = myFoods.findIndex((f) => f.id === over.id);
      const newOrderedFoods = arrayMove(myFoods, oldIndex, newIndex);
      setMyFoods(newOrderedFoods);
      syncToCloud(history, newOrderedFoods);
    }
  };

  const dayData = history[selectedDate] || { totals: { calories: 0, protein: 0, carbs: 0, fiber: 0 }, items: [] };
  
  // 計算蛋白質進度百分比
  const proteinTarget = 150;
  const proteinProgress = Math.min((dayData.totals.protein / proteinTarget) * 100, 100);

  const filteredFrequentFoods = myFoods.filter(food => 
    food.name.toLowerCase().includes(query.toLowerCase())
  );

  const addNutrients = (name: string, data: any) => {
    const currentDay = history[selectedDate] || { totals: { calories: 0, protein: 0, carbs: 0, fiber: 0 }, items: [] };
    const newItem = {
      id: Date.now(),
      name,
      calories: Math.round(data.calories),
      protein: Math.round(data.protein * 10) / 10,
      carbs: Math.round(data.carbs * 10) / 10,
      fiber: Math.round(data.fiber * 10) / 10,
      weight: data.weight
    };
    const newHistory = {
      ...history,
      [selectedDate]: {
        totals: {
          calories: (currentDay.totals.calories || 0) + newItem.calories,
          protein: Math.round(((currentDay.totals.protein || 0) + newItem.protein) * 10) / 10,
          carbs: Math.round(((currentDay.totals.carbs || 0) + newItem.carbs) * 10) / 10,
          fiber: Math.round(((currentDay.totals.fiber || 0) + newItem.fiber) * 10) / 10,
        },
        items: [newItem, ...currentDay.items]
      }
    };
    setHistory(newHistory);
    syncToCloud(newHistory);
  };

  const deleteItem = (itemId: number) => {
    const currentDay = history[selectedDate];
    if (!currentDay) return;
    const itemToDelete = currentDay.items.find((i: any) => i.id === itemId);
    const filteredItems = currentDay.items.filter((i: any) => i.id !== itemId);
    const newHistory = {
      ...history,
      [selectedDate]: {
        totals: {
          calories: (currentDay.totals.calories || 0) - (itemToDelete.calories || 0),
          protein: Math.round(((currentDay.totals.protein || 0) - (itemToDelete.protein || 0)) * 10) / 10,
          carbs: Math.round(((currentDay.totals.carbs || 0) - (itemToDelete.carbs || 0)) * 10) / 10,
          fiber: Math.round(((currentDay.totals.fiber || 0) - (itemToDelete.fiber || 0)) * 10) / 10,
        },
        items: filteredItems
      }
    };
    setHistory(newHistory);
    syncToCloud(newHistory);
  };

  const handleEditMyFood = (food: any) => {
    setEditingFoodId(food.id);
    setManualFood({
      name: food.name,
      calories: food.calories.toString(),
      protein: food.protein.toString(),
      carbs: food.carbs.toString(),
      fiber: food.fiber.toString(),
      servingSize: food.servingSize.toString(),
      actualEat: '100'
    });
    setShowManual(true);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ratio = Number(manualFood.actualEat) / Number(manualFood.servingSize);
    
    if (editingFoodId) {
      const updatedMyFoods = myFoods.map(f => f.id === editingFoodId ? {
        ...f,
        name: manualFood.name,
        calories: Number(manualFood.calories),
        protein: Number(manualFood.protein),
        carbs: Number(manualFood.carbs),
        fiber: Number(manualFood.fiber),
        servingSize: Number(manualFood.servingSize)
      } : f);
      setMyFoods(updatedMyFoods);
      syncToCloud(history, updatedMyFoods);
      setEditingFoodId(null);
    } else {
      const nutrients = {
        calories: Number(manualFood.calories) * ratio,
        protein: Number(manualFood.protein) * ratio,
        carbs: Number(manualFood.carbs) * ratio,
        fiber: Number(manualFood.fiber) * ratio,
        weight: manualFood.actualEat
      };
      addNutrients(manualFood.name, nutrients);

      if (!myFoods.some(f => f.name === manualFood.name)) {
        const newMyFoods = [{ 
          id: Date.now(), name: manualFood.name, brand: "My Food", calories: Number(manualFood.calories), 
          protein: Number(manualFood.protein), carbs: Number(manualFood.carbs), fiber: Number(manualFood.fiber), 
          servingSize: Number(manualFood.servingSize), servingUnit: "g" 
        }, ...myFoods];
        setMyFoods(newMyFoods);
        syncToCloud(history, newMyFoods);
      }
    }
    setManualFood({ name: '', calories: '', protein: '', carbs: '', fiber: '', servingSize: '100', actualEat: '100' });
    setShowManual(false);
  };

  if (dbLoading) return <div className="min-h-screen bg-indigo-50 flex items-center justify-center font-black text-indigo-300 animate-pulse uppercase tracking-widest">Loading Your Goals...</div>;

  return (
    <main className="min-h-screen bg-[#F8FAFF] p-4 pb-24 font-sans text-slate-900">
      <div className="max-w-md mx-auto">
        
        {/* 日期選擇器 */}
        <div className="flex items-center justify-between mb-8 bg-white p-3 rounded-[2rem] shadow-sm border border-indigo-50/50">
          <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toLocaleDateString('en-CA'))}} className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-500 rounded-full font-bold transition-all active:scale-90">←</button>
          <div className="flex flex-col items-center">
            <input type="date" className="font-black text-slate-800 outline-none text-center bg-transparent text-lg" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-0.5">YI-CHING'S TRACKER</p>
          </div>
          <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toLocaleDateString('en-CA'))}} className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-500 rounded-full font-bold transition-all active:scale-90">→</button>
        </div>

        {/* 核心進度看板 */}
        <div className="bg-white rounded-[3rem] shadow-xl shadow-indigo-100/50 p-8 mb-8 border border-indigo-50 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 z-0"></div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2">
                  {dayData.totals.protein} <span className="text-sm text-slate-400">g</span>
                </h2>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Protein Power</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Target: {proteinTarget}g</p>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black ${dayData.totals.protein >= proteinTarget ? 'bg-amber-400 text-white animate-bounce' : 'bg-slate-100 text-slate-400'}`}>
                  {dayData.totals.protein >= proteinTarget ? '🔥 GOAL REACHED' : '⚡ KEEP PUSHING'}
                </div>
              </div>
            </div>

            {/* 進度條渲染 */}
            <div className="h-6 w-full bg-slate-50 rounded-full overflow-hidden mb-6 p-1 border border-slate-100">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out relative ${dayData.totals.protein >= proteinTarget ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                style={{ width: `${proteinProgress}%` }}
              >
                {proteinProgress > 15 && <span className="absolute right-2 top-0 text-[8px] font-black text-white leading-4">{Math.round(proteinProgress)}%</span>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center bg-slate-50 py-3 rounded-2xl border border-slate-100/50">
                <p className="text-lg font-black text-slate-700">{dayData.totals.calories}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">⚡ Energy</p>
              </div>
              <div className="text-center bg-slate-50 py-3 rounded-2xl border border-slate-100/50">
                <p className="text-lg font-black text-slate-700">{dayData.totals.carbs}g</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">🍞 Carbs</p>
              </div>
              <div className="text-center bg-slate-50 py-3 rounded-2xl border border-slate-100/50">
                <p className="text-lg font-black text-slate-700">{dayData.totals.fiber}g</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">🥗 Fiber</p>
              </div>
            </div>
          </div>
        </div>

        {/* 搜尋欄與新增按鈕 */}
        <div className="flex gap-3 mb-6 items-center px-1">
          <div className="relative flex-1 group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </span>
            <input type="text" className="w-full pl-11 pr-4 py-4 bg-white shadow-xl shadow-indigo-100/20 rounded-[1.5rem] outline-none border-2 border-transparent focus:border-indigo-100 transition-all font-bold placeholder:text-slate-300" placeholder="搜尋常用食材..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button onClick={() => { setEditingFoodId(null); setShowManual(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white h-14 w-14 rounded-[1.5rem] font-black shadow-lg shadow-indigo-200 transition-all active:scale-90 flex items-center justify-center text-2xl">+</button>
        </div>

        {/* 食物清單 */}
        <div className="mb-10 px-1">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2 italic">Frequent Foods</h3>
             {query && <button onClick={()=>setQuery('')} className="text-[10px] font-black text-indigo-400">CLEAR SEARCH</button>}
          </div>
          
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredFrequentFoods.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {filteredFrequentFoods.map(food => (
                <SortableFoodItem key={food.id} food={food} onSelect={setSelectedFood} onEdit={handleEditMyFood} onDelete={(id: number) => { 
                  if(confirm("🗑️ 確定要刪除這項常用食材嗎？")) { 
                    const newF = myFoods.filter(f => f.id !== id); 
                    setMyFoods(newF); 
                    syncToCloud(history, newF); 
                  }
                }} />
              ))}
            </SortableContext>
          </DndContext>

          {filteredFrequentFoods.length === 0 && (
            <div className="text-center py-10 bg-white/50 rounded-[2rem] border-2 border-dashed border-slate-200">
               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No match found</p>
            </div>
          )}
        </div>

        {/* 紀錄列表 */}
        {dayData.items.length > 0 && (
          <div className="mb-8 px-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 ml-2 italic">Today's Meal Log</h3>
            <div className="space-y-3">
              {dayData.items.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center bg-white/60 p-4 rounded-2xl border border-indigo-50/50 backdrop-blur-sm shadow-sm group">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-300"></div>
                    <div>
                      <p className="font-bold text-slate-700 text-sm leading-tight">{item.name}</p>
                      <p className="text-[9px] text-slate-400 font-black tracking-tighter uppercase mt-0.5">{item.weight}g · P: {item.protein}g · {item.calories}kcal</p>
                    </div>
                  </div>
                  <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-400 transition-colors p-1">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 彈窗 UI 依照此風格延伸 (略) */}
        {/* ... 保留原本彈窗邏輯與架構 ... */}

      </div>
    </main>
  );
}