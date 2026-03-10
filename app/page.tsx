"use client";

import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// --- 1. 引入拖曳相關套件 ---
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

// --- 2. 建立可拖曳的元件項目 ---
function SortableFoodItem({ food, onSelect, onEdit, onDelete }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: food.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 group">
      {/* 拖曳手把 */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 text-slate-300 hover:text-slate-500">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7 7h2v2H7V7zm0 4h2v2H7v-2zm4-4h2v2h-2V7zm0 4h2v2h-2v-2zM7 15h2v2H7v-2zm4 0h2v2h-2v-2z"/></svg>
      </div>

      <button onClick={() => onSelect(food)} className="flex-1 text-left p-4 bg-white border border-slate-100 rounded-2xl shadow-sm transition active:scale-95">
        <div className="flex justify-between items-center">
          <span className="font-bold text-slate-700">{food.name}</span>
          <span className="text-[10px] text-slate-300 font-black">基準: {food.servingSize}g</span>
        </div>
        <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tight">
          P: {food.protein}g · C: {food.calories}kcal · F: {food.fiber}g
        </div>
      </button>

      <div className="flex flex-col gap-1">
        <button onClick={() => onEdit(food)} className="bg-blue-50 text-blue-400 p-2 rounded-xl hover:bg-blue-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
        </button>
        <button onClick={() => onDelete(food.id)} className="bg-red-50 text-red-300 p-2 rounded-xl hover:bg-red-100">✕</button>
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

  // --- 3. 配置拖曳感應器 ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // 避免誤點擊
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

  // --- 4. 處理拖曳結束後的排序 ---
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
          id: Date.now(), 
          name: manualFood.name, 
          brand: "My Food", 
          calories: Number(manualFood.calories), 
          protein: Number(manualFood.protein), 
          carbs: Number(manualFood.carbs), 
          fiber: Number(manualFood.fiber), 
          servingSize: Number(manualFood.servingSize), 
          servingUnit: "g" 
        }, ...myFoods];
        setMyFoods(newMyFoods);
        syncToCloud(history, newMyFoods);
      }
    }
    setManualFood({ name: '', calories: '', protein: '', carbs: '', fiber: '', servingSize: '100', actualEat: '100' });
    setShowManual(false);
  };

  if (dbLoading) return <div className="min-h-screen flex items-center justify-center font-black text-slate-400">CONNECTING TO CLOUD...</div>;

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-24 font-sans text-slate-900">
      <div className="max-w-md mx-auto">
        
        {/* 日期區塊、看板、今日內容略 (保持不變) */}
        <div className="flex items-center justify-between mb-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toLocaleDateString('en-CA'))}} className="p-2 text-slate-400 font-bold">←</button>
          <div className="flex flex-col items-center">
            <input type="date" className="font-black text-slate-700 outline-none text-center bg-transparent" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            <button onClick={() => { if(confirm("確定要清空今天的紀錄嗎？")) { const newH = {...history, [selectedDate]: undefined}; setHistory(newH); syncToCloud(newH); } }} className="text-[10px] font-black text-red-400 uppercase tracking-tighter mt-1">Reset Today</button>
          </div>
          <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toLocaleDateString('en-CA'))}} className="p-2 text-slate-400 font-bold">→</button>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl p-6 mb-6 border-b-4 border-blue-50">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-black text-slate-800">Daily Total</h2>
            <div className={`text-[10px] font-black px-3 py-1 rounded-full ${dayData.totals.protein >= 150 ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'}`}>Target: 150g Pro</div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-slate-50 rounded-2xl py-3"><p className="text-lg font-black">{dayData.totals.calories || 0}</p><p className="text-[8px] font-bold text-slate-400 uppercase">Cals</p></div>
            <div className={`rounded-2xl py-3 border ${(dayData.totals.protein || 0) >= 150 ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}><p className={`text-lg font-black ${(dayData.totals.protein || 0) >= 150 ? 'text-emerald-600' : 'text-blue-600'}`}>{dayData.totals.protein || 0}g</p><p className="text-[8px] font-bold uppercase opacity-60">Pro</p></div>
            <div className="bg-slate-50 rounded-2xl py-3"><p className="text-lg font-black">{dayData.totals.carbs || 0}g</p><p className="text-[8px] font-bold text-slate-400 uppercase">Carb</p></div>
            <div className="bg-slate-50 rounded-2xl py-3"><p className="text-lg font-black">{dayData.totals.fiber || 0}g</p><p className="text-[8px] font-bold text-slate-400 uppercase">Fiber</p></div>
          </div>
        </div>

        {dayData.items.length > 0 && (
          <div className="mb-8 px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 italic">Today's Log</h3>
            <div className="space-y-2">
              {dayData.items.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-50">
                  <div>
                    <p className="font-bold text-slate-700 text-sm">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{item.weight}g · P: {item.protein}g · {item.calories}kcal</p>
                  </div>
                  <button onClick={() => deleteItem(item.id)} className="text-slate-200 hover:text-red-400 text-lg p-1">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 搜尋欄位 */}
        <div className="flex gap-2 mb-4">
          <input type="text" className="flex-1 p-4 bg-white shadow-md rounded-2xl outline-none" placeholder="搜尋常用食材..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <button onClick={() => { setEditingFoodId(null); setShowManual(true); }} className="bg-slate-900 text-white w-14 rounded-2xl font-bold shadow-md text-2xl">+</button>
        </div>

        {/* --- 5. 拖曳列表實作 --- */}
        <div className="mb-8 space-y-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 italic">
            {query ? `Search Results (${filteredFrequentFoods.length})` : "Frequent Foods (Drag to reorder)"}
          </h3>
          
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={filteredFrequentFoods.map(f => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {filteredFrequentFoods.map(food => (
                <SortableFoodItem 
                  key={food.id} 
                  food={food} 
                  onSelect={setSelectedFood}
                  onEdit={handleEditMyFood}
                  onDelete={(id: number) => { 
                    if(confirm("刪除常用食材?")) { 
                      const newF = myFoods.filter(f => f.id !== id); 
                      setMyFoods(newF); 
                      syncToCloud(history, newF); 
                    }
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>

          {filteredFrequentFoods.length === 0 && (
            <p className="text-center py-4 text-slate-300 text-xs font-bold uppercase tracking-widest">No frequent food found</p>
          )}
        </div>

        {/* 彈窗略 (保持不變) */}
        {selectedFood && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-xl font-black text-center mb-6">{selectedFood.name}</h3>
              <div className="bg-slate-50 rounded-3xl p-6 mb-6 text-center">
                <input autoFocus type="number" className="w-24 text-4xl font-black text-center bg-transparent border-b-4 border-blue-500 outline-none text-blue-600" value={weight} onChange={(e) => setWeight(e.target.value)} />
                <span className="text-xl font-bold text-slate-300 ml-2">g</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setSelectedFood(null)} className="py-4 rounded-2xl font-bold text-slate-400 bg-slate-100">取消</button>
                <button onClick={() => {
                  const factor = Number(weight) / (selectedFood.servingSize || 100);
                  addNutrients(selectedFood.name, { calories: selectedFood.calories * factor, protein: selectedFood.protein * factor, carbs: selectedFood.carbs * factor, fiber: selectedFood.fiber * factor, weight: weight });
                  setSelectedFood(null); setWeight('100');
                  setQuery('');
                }} className="py-4 rounded-2xl font-bold text-white bg-blue-600 shadow-lg shadow-blue-200">確認加入</button>
              </div>
            </div>
          </div>
        )}

        {showManual && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 font-black text-xl italic uppercase tracking-tighter">
                {editingFoodId ? "Edit Food" : "Quick Add"}
                <button onClick={() => { setShowManual(false); setEditingFoodId(null); }} className="text-slate-300">✕</button>
              </div>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <input required placeholder="食物名稱" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" value={manualFood.name} onChange={e => setManualFood({...manualFood, name: e.target.value})} />
                <div className="p-4 bg-blue-50 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">標籤數值 (Nutrients)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-xl p-2"><label className="text-[8px] block font-black text-slate-300 uppercase">基準重(g)</label><input required type="number" className="w-full outline-none text-sm font-bold" value={manualFood.servingSize} onChange={e => setManualFood({...manualFood, servingSize: e.target.value})} /></div>
                    <div className="bg-white rounded-xl p-2"><label className="text-[8px] block font-black text-slate-300 uppercase">熱量</label><input required type="number" className="w-full outline-none text-sm font-bold" value={manualFood.calories} onChange={e => setManualFood({...manualFood, calories: e.target.value})} /></div>
                    <div className="bg-white rounded-xl p-2"><label className="text-[8px] block font-black text-slate-300 uppercase">蛋白質</label><input required type="number" step="0.1" className="w-full outline-none text-sm font-bold" value={manualFood.protein} onChange={e => setManualFood({...manualFood, protein: e.target.value})} /></div>
                    <div className="bg-white rounded-xl p-2"><label className="text-[8px] block font-black text-slate-300 uppercase">碳水</label><input required type="number" step="0.1" className="w-full outline-none text-sm font-bold" value={manualFood.carbs} onChange={e => setManualFood({...manualFood, carbs: e.target.value})} /></div>
                    <div className="bg-white rounded-xl p-2 col-span-2"><label className="text-[8px] block font-black text-slate-300 uppercase">纖維</label><input required type="number" step="0.1" className="w-full outline-none text-sm font-bold" value={manualFood.fiber} onChange={e => setManualFood({...manualFood, fiber: e.target.value})} /></div>
                  </div>
                </div>
                
                {!editingFoodId && (
                  <div className="p-4 bg-emerald-50 rounded-2xl">
                    <p className="text-[10px] font-black text-emerald-500 uppercase mb-2 tracking-widest">實際攝取重量 (Actually Ate)</p>
                    <input required type="number" className="w-full p-3 rounded-xl font-black text-emerald-600 outline-none" value={manualFood.actualEat} onChange={e => setManualFood({...manualFood, actualEat: e.target.value})} />
                  </div>
                )}

                <button type="submit" className="w-full bg-slate-900 text-white p-5 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-slate-200">
                  {editingFoodId ? "Save Changes" : "Save & Add to Log"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}