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

// --- 常用食材項目 (包含恢復的編輯與刪除功能) ---
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
        <div className="flex gap-3 items-center text-[10px] font-bold text-slate-400">
          <span className="text-indigo-500">🍖 {food.protein}g</span>
          <span className="text-orange-400">⚡ {food.calories}kcal</span>
        </div>
      </button>

      <div className="flex flex-col gap-1">
        <button onClick={() => onEdit(food)} className="bg-indigo-50 text-indigo-400 p-2.5 rounded-xl hover:bg-indigo-500 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        </button>
        <button onClick={() => onDelete(food.id)} className="bg-red-50 text-red-300 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all">
          ✕
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

  const PROTEIN_GOAL = 100; // 目標調整為 100g

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
  const proteinProgress = Math.min((dayData.totals.protein / PROTEIN_GOAL) * 100, 100);

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
      // 這裡恢復「新增至今日紀錄」的功能
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

  if (dbLoading) return <div className="min-h-screen bg-indigo-50 flex items-center justify-center font-black text-indigo-300 animate-pulse uppercase tracking-widest text-center px-10">Syncing with Cloud...</div>;

  return (
    <main className="min-h-screen bg-[#F8FAFF] p-4 pb-24 font-sans text-slate-900">
      <div className="max-w-md mx-auto">
        
        {/* 日期區塊 */}
        <div className="flex items-center justify-between mb-8 bg-white p-3 rounded-[2rem] shadow-sm border border-indigo-50/50">
          <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toLocaleDateString('en-CA'))}} className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-500 rounded-full font-bold">←</button>
          <input type="date" className="font-black text-slate-800 outline-none text-center bg-transparent" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toLocaleDateString('en-CA'))}} className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-500 rounded-full font-bold">→</button>
        </div>

        {/* 100g 目標進度條 */}
        <div className="bg-white rounded-[3rem] shadow-xl p-8 mb-8 border border-indigo-50">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2">
                {dayData.totals.protein} <span className="text-sm text-slate-400">g</span>
              </h2>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Today's Protein</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black ${dayData.totals.protein >= PROTEIN_GOAL ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'}`}>
              Goal: {PROTEIN_GOAL}g
            </div>
          </div>
          <div className="h-6 w-full bg-slate-50 rounded-full overflow-hidden p-1 border border-slate-100">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out ${dayData.totals.protein >= PROTEIN_GOAL ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
              style={{ width: `${proteinProgress}%` }}
            ></div>
          </div>
        </div>

        {/* 搜尋與「+」號 */}
        <div className="flex gap-3 mb-6">
          <input type="text" className="flex-1 pl-6 pr-4 py-4 bg-white shadow-md rounded-[1.5rem] outline-none font-bold" placeholder="搜尋常用食材..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <button onClick={() => { setEditingFoodId(null); setShowManual(true); }} className="bg-indigo-600 text-white h-14 w-14 rounded-[1.5rem] font-black shadow-lg shadow-indigo-200 text-2xl active:scale-90 transition-all">+</button>
        </div>

        {/* 常用食材列表 */}
        <div className="mb-10">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2 italic">Frequent Foods</h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={myFoods.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {myFoods.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).map(food => (
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
        </div>

        {/* 今日記錄清單 */}
        {dayData.items.length > 0 && (
          <div className="mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2 italic">Today's Logs</h3>
            <div className="space-y-3">
              {dayData.items.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-indigo-50 shadow-sm">
                  <div>
                    <p className="font-bold text-slate-700 text-sm">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase">{item.weight}g · P: {item.protein}g</p>
                  </div>
                  <button onClick={() => {
                    const currentDay = history[selectedDate];
                    const filteredItems = currentDay.items.filter((i: any) => i.id !== item.id);
                    const newHistory = {
                      ...history,
                      [selectedDate]: {
                        totals: {
                          calories: currentDay.totals.calories - item.calories,
                          protein: Math.round((currentDay.totals.protein - item.protein) * 10) / 10,
                          carbs: (currentDay.totals.carbs || 0),
                          fiber: (currentDay.totals.fiber || 0),
                        },
                        items: filteredItems
                      }
                    };
                    setHistory(newHistory);
                    syncToCloud(newHistory);
                  }} className="text-slate-200 hover:text-red-400">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 彈窗：輸入重量 */}
        {selectedFood && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl">
              <h3 className="text-xl font-black text-center mb-6 text-slate-800">{selectedFood.name}</h3>
              <div className="bg-indigo-50 rounded-[2rem] p-8 mb-6 text-center border-2 border-indigo-100/50">
                <input autoFocus type="number" className="w-32 text-5xl font-black text-center bg-transparent border-b-4 border-indigo-500 outline-none text-indigo-600" value={weight} onChange={(e) => setWeight(e.target.value)} />
                <span className="text-xl font-black text-indigo-300 ml-2">g</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setSelectedFood(null)} className="py-4 rounded-2xl font-black text-slate-400 bg-slate-100">Cancel</button>
                <button onClick={() => {
                  const factor = Number(weight) / selectedFood.servingSize;
                  addNutrients(selectedFood.name, { calories: selectedFood.calories * factor, protein: selectedFood.protein * factor, carbs: selectedFood.carbs * factor, fiber: selectedFood.fiber * factor, weight: weight });
                  setSelectedFood(null); setWeight('100');
                }} className="py-4 rounded-2xl font-black text-white bg-indigo-600 shadow-lg">Add Log</button>
              </div>
            </div>
          </div>
        )}

        {/* 彈窗：手動新增/編輯 */}
        {showManual && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="font-black text-xl italic mb-6 uppercase tracking-tighter text-slate-800">
                {editingFoodId ? "Edit Food" : "Quick Add"}
              </h3>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <input required placeholder="食物名稱" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={manualFood.name} onChange={e => setManualFood({...manualFood, name: e.target.value})} />
                <div className="grid grid-cols-2 gap-3 bg-indigo-50 p-4 rounded-3xl">
                  <div><label className="text-[8px] font-black text-slate-400 block mb-1">基準重 (g)</label><input required type="number" className="w-full bg-white p-2 rounded-xl text-sm font-bold" value={manualFood.servingSize} onChange={e => setManualFood({...manualFood, servingSize: e.target.value})} /></div>
                  <div><label className="text-[8px] font-black text-slate-400 block mb-1">熱量 (kcal)</label><input required type="number" className="w-full bg-white p-2 rounded-xl text-sm font-bold" value={manualFood.calories} onChange={e => setManualFood({...manualFood, calories: e.target.value})} /></div>
                  <div><label className="text-[8px] font-black text-slate-400 block mb-1">蛋白質 (g)</label><input required type="number" step="0.1" className="w-full bg-white p-2 rounded-xl text-sm font-bold" value={manualFood.protein} onChange={e => setManualFood({...manualFood, protein: e.target.value})} /></div>
                  <div><label className="text-[8px] font-black text-slate-400 block mb-1">碳水 (g)</label><input required type="number" step="0.1" className="w-full bg-white p-2 rounded-xl text-sm font-bold" value={manualFood.carbs} onChange={e => setManualFood({...manualFood, carbs: e.target.value})} /></div>
                </div>
                {!editingFoodId && (
                  <div className="p-4 bg-emerald-50 rounded-3xl text-center">
                    <label className="text-[8px] font-black text-emerald-500 block mb-2 tracking-widest italic">今日吃了多少 (g)</label>
                    <input required type="number" className="w-full bg-white p-3 rounded-xl font-black text-emerald-600 outline-none text-center" value={manualFood.actualEat} onChange={e => setManualFood({...manualFood, actualEat: e.target.value})} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button type="button" onClick={() => { setShowManual(false); setEditingFoodId(null); }} className="p-4 rounded-2xl font-black text-slate-400 bg-slate-100">Cancel</button>
                  <button type="submit" className="p-4 rounded-2xl font-black text-white bg-slate-900 shadow-lg">{editingFoodId ? "Update" : "Save & Add"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

// 輔助函數：處理編輯狀態
function handleEditMyFood(food: any) {
  // 此邏輯在組件內由 useState 觸發，故直接在組件內實作
}