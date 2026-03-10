"use client";

import React, { useState, useEffect } from 'react';
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

// Firebase Config (保持不變)
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

// --- 常用食材組件 (視覺強化版) ---
function SortableFoodItem({ food, onSelect, onEdit, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: food.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2 mb-3 group transition-all ${isDragging ? "scale-105" : ""}`}>
      <div {...attributes} {...listeners} className="cursor-grab p-2 text-slate-300 hover:text-indigo-400">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8h16M4 16h16"></path></svg>
      </div>

      <button onClick={() => onSelect(food)} className="flex-1 text-left p-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md hover:border-indigo-200 transition-all relative overflow-hidden">
        <div className="flex justify-between items-center mb-1">
          <span className="font-black text-slate-700 italic">🍲 {food.name}</span>
          <span className="text-[9px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded-full font-bold">{food.servingSize}g</span>
        </div>
        <div className="flex gap-3 text-[10px] font-black uppercase tracking-tighter">
          <span className="text-indigo-500">P: {food.protein}g</span>
          <span className="text-amber-500">C: {food.calories}kcal</span>
          <span className="text-emerald-500">Carbs: {food.carbs}g</span>
        </div>
      </button>

      <div className="flex flex-col gap-1">
        <button onClick={() => onEdit(food)} className="bg-indigo-50 text-indigo-500 p-2.5 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        </button>
        <button onClick={() => onDelete(food.id)} className="bg-rose-50 text-rose-400 p-2.5 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm">✕</button>
      </div>
    </div>
  );
}

export default function Home() {
  const [dbLoading, setDbLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [history, setHistory] = useState<any>({}); 
  const [myFoods, setMyFoods] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<any>(null); 
  const [showManual, setShowManual] = useState(false);
  const [weight, setWeight] = useState('100');
  const [editingFoodId, setEditingFoodId] = useState<any>(null);
  const [manualFood, setManualFood] = useState({ name: '', calories: '', protein: '', carbs: '', fiber: '', servingSize: '100', actualEat: '100' });

  const PROTEIN_GOAL = 100;
  const CALORIE_GOAL = 2000;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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

  const syncToCloud = async (newHistory: any, newMyFoods: any[]) => {
    await setDoc(doc(db, "trackers", "yi-ching-data"), { history: newHistory, myFoods: newMyFoods });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = myFoods.findIndex((f) => f.id === active.id);
      const newIndex = myFoods.findIndex((f) => f.id === over.id);
      const newOrdered = arrayMove(myFoods, oldIndex, newIndex);
      setMyFoods(newOrdered);
      syncToCloud(history, newOrdered);
    }
  };

  const dayData = history[selectedDate] || { totals: { calories: 0, protein: 0, carbs: 0, fiber: 0 }, items: [] };
  const proteinProgress = Math.min((dayData.totals.protein / PROTEIN_GOAL) * 100, 100);
  const calorieProgress = Math.min((dayData.totals.calories / CALORIE_GOAL) * 100, 100);

  const addNutrients = (name: string, data: any) => {
    const newItem = { id: Date.now(), name, calories: Math.round(data.calories), protein: Math.round(data.protein * 10) / 10, carbs: Math.round(data.carbs * 10) / 10, fiber: Math.round(data.fiber * 10) / 10, weight: data.weight };
    const newHistory = { ...history, [selectedDate]: { totals: { calories: (dayData.totals.calories || 0) + newItem.calories, protein: Math.round(((dayData.totals.protein || 0) + newItem.protein) * 10) / 10, carbs: Math.round(((dayData.totals.carbs || 0) + newItem.carbs) * 10) / 10, fiber: Math.round(((dayData.totals.fiber || 0) + newItem.fiber) * 10) / 10 }, items: [newItem, ...dayData.items] } };
    setHistory(newHistory);
    syncToCloud(newHistory, myFoods);
  };

  const changeDate = (offset: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + offset);
    setSelectedDate(date.toLocaleDateString('en-CA'));
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const foodItem = { id: editingFoodId || Date.now(), name: manualFood.name, calories: Number(manualFood.calories), protein: Number(manualFood.protein), carbs: Number(manualFood.carbs), fiber: Number(manualFood.fiber), servingSize: Number(manualFood.servingSize) };
    let newMyFoods = [...myFoods];
    if (editingFoodId) { newMyFoods = myFoods.map(f => f.id === editingFoodId ? foodItem : f); } 
    else {
      newMyFoods = [foodItem, ...myFoods];
      const ratio = Number(manualFood.actualEat) / foodItem.servingSize;
      addNutrients(foodItem.name, { calories: foodItem.calories * ratio, protein: foodItem.protein * ratio, carbs: foodItem.carbs * ratio, fiber: foodItem.fiber * ratio, weight: manualFood.actualEat });
    }
    setMyFoods(newMyFoods); syncToCloud(history, newMyFoods); setShowManual(false); setEditingFoodId(null);
    setManualFood({ name: '', calories: '', protein: '', carbs: '', fiber: '', servingSize: '100', actualEat: '100' });
  };

  const handleEdit = (food: any) => {
    setEditingFoodId(food.id);
    setManualFood({ name: food.name, calories: food.calories.toString(), protein: food.protein.toString(), carbs: food.carbs.toString(), fiber: food.fiber.toString(), servingSize: food.servingSize.toString(), actualEat: food.servingSize.toString() });
    setShowManual(true);
  };

  if (dbLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center font-black text-indigo-400 italic animate-pulse">LOADING DASHBOARD...</div>;

  return (
    <main className="min-h-screen bg-[#F0F4F8] p-4 pb-24 font-sans text-slate-900">
      <div className="max-w-md mx-auto">
        
        {/* --- 大標題 YC's DailyMacro --- */}
        <header className="mb-6 pt-4 px-2">
          <h1 className="text-3xl font-black italic tracking-tighter text-slate-800 drop-shadow-sm">
            YC's <span className="text-indigo-600">DailyMacro</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 ml-1">Precision Nutrition Tracker</p>
        </header>

        {/* --- 日期選擇器 --- */}
        <div className="bg-white rounded-[2rem] shadow-sm mb-6 p-2 flex items-center justify-between border border-slate-100">
          <button onClick={() => changeDate(-1)} className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-full hover:bg-indigo-50 hover:text-indigo-500 transition-all font-bold">←</button>
          <div className="relative flex items-center gap-2">
            <span className="text-sm">📅</span>
            <input 
              type="date" 
              className="font-black text-slate-700 bg-transparent outline-none cursor-pointer" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
            />
          </div>
          <button onClick={() => changeDate(1)} className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-full hover:bg-indigo-50 hover:text-indigo-500 transition-all font-bold">→</button>
        </div>
        
        {/* --- 視覺化 Dashboard --- */}
        <section className="bg-white rounded-[2.5rem] shadow-2xl p-6 mb-6 border border-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
          
          <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
            <div className="bg-indigo-50/50 p-4 rounded-3xl border border-indigo-100">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">🔥 Calories</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-800">{dayData.totals.calories}</span>
                <span className="text-[10px] font-bold text-slate-400 italic">kcal</span>
              </div>
            </div>
            <div className="bg-amber-50/50 p-4 rounded-3xl border border-amber-100">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">🥩 Protein</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-800">{dayData.totals.protein}</span>
                <span className="text-[10px] font-bold text-slate-400 italic">g</span>
              </div>
            </div>
            <div className="bg-emerald-50/50 p-4 rounded-3xl border border-emerald-100">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-1">🥗 Carbs</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-800">{dayData.totals.carbs}</span>
                <span className="text-[10px] font-bold text-slate-400 italic">g</span>
              </div>
            </div>
            <div className="bg-purple-50/50 p-4 rounded-3xl border border-purple-100">
              <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block mb-1">🌾 Fiber</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-800">{dayData.totals.fiber}</span>
                <span className="text-[10px] font-bold text-slate-400 italic">g</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 relative z-10">
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase mb-1.5 px-1 text-slate-400">
                <span>Protein Goal (100g)</span>
                <span className={dayData.totals.protein >= PROTEIN_GOAL ? "text-indigo-600 font-black" : ""}>{Math.round(proteinProgress)}%</span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full p-1 border border-slate-50">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${dayData.totals.protein >= PROTEIN_GOAL ? 'bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse' : 'bg-indigo-600'}`}
                  style={{ width: `${proteinProgress}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase mb-1.5 px-1 text-slate-400">
                <span>Calorie Limit (2000)</span>
                <span>{dayData.totals.calories} kcal</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-300 transition-all duration-1000"
                  style={{ width: `${calorieProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </section>

        {/* 搜尋欄與新增鈕 */}
        <div className="flex gap-2 mb-8">
          <div className="flex-1 relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">🔍</span>
            <input className="w-full pl-12 pr-6 py-4 bg-white shadow-sm rounded-2xl font-bold outline-none border border-transparent focus:border-indigo-100 transition-all" placeholder="Search my foods..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <button onClick={() => { setEditingFoodId(null); setShowManual(true); }} className="bg-slate-900 text-white w-14 h-14 rounded-2xl font-black text-2xl shadow-xl hover:bg-indigo-600 transition-all active:scale-90">+</button>
        </div>

        {/* 今日記錄 (Today's Logs) */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4 ml-2">
            <span className="text-lg">📅</span>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Daily Records</h3>
          </div>
          <div className="space-y-3">
            {dayData.items.length === 0 ? (
              <div className="bg-white/40 border-2 border-dashed border-slate-200 rounded-3xl py-10 text-center text-slate-300 font-bold italic">Empty for this date</div>
            ) : (
              dayData.items.map((item: any) => (
                <div key={item.id} className="bg-white p-4 rounded-[1.5rem] flex justify-between items-center shadow-sm border border-slate-50 group hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 font-black italic text-xs tracking-tighter">
                      {item.protein}g
                    </div>
                    <div>
                      <p className="font-black text-slate-700 text-sm italic">{item.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{item.weight}g · {item.calories}kcal · C:{item.carbs}g</p>
                    </div>
                  </div>
                  <button onClick={() => {
                    const newItems = dayData.items.filter((i: any) => i.id !== item.id);
                    const newHistory = { ...history, [selectedDate]: { totals: { calories: dayData.totals.calories - item.calories, protein: Math.round((dayData.totals.protein - item.protein) * 10) / 10, carbs: Math.round((dayData.totals.carbs - (item.carbs || 0)) * 10) / 10, fiber: Math.round((dayData.totals.fiber - (item.fiber || 0)) * 10) / 10 }, items: newItems } };
                    setHistory(newHistory); syncToCloud(newHistory, myFoods);
                  }} className="text-slate-200 hover:text-rose-500 font-bold p-2 transition-colors">✕</button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 常用食材 (Favorites) */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4 ml-2">
            <span className="text-lg">⭐</span>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Frequent Foods</h3>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={myFoods.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {myFoods.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).map(food => (
                <SortableFoodItem key={food.id} food={food} onSelect={setSelectedFood} onEdit={handleEdit} onDelete={(id: any) => { if(confirm("Delete this favorite?")) { const newF = myFoods.filter(f => f.id !== id); setMyFoods(newF); syncToCloud(history, newF); } }} />
              ))}
            </SortableContext>
          </DndContext>
        </section>

        {/* 彈窗系列 (重量與新增編輯保持不變) */}
        {selectedFood && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200 text-center">
              <h3 className="text-xl font-black text-slate-800 italic mb-6">⚖️ {selectedFood.name}</h3>
              <div className="bg-indigo-50 rounded-[2.5rem] p-10 mb-8 border-2 border-indigo-100">
                <input autoFocus type="number" className="w-32 text-6xl font-black text-center bg-transparent border-b-4 border-indigo-500 outline-none text-indigo-600" value={weight} onChange={e => setWeight(e.target.value)} />
                <span className="text-2xl font-black text-indigo-200 ml-2 italic">g</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setSelectedFood(null)} className="py-5 font-black text-slate-400 bg-slate-50 rounded-2xl">Cancel</button>
                <button onClick={() => {
                  const r = Number(weight) / selectedFood.servingSize;
                  addNutrients(selectedFood.name, { calories: selectedFood.calories * r, protein: selectedFood.protein * r, carbs: selectedFood.carbs * r, fiber: selectedFood.fiber * r, weight: weight });
                  setSelectedFood(null); setWeight('100');
                }} className="py-5 font-black text-white bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100">Add Meal</button>
              </div>
            </div>
          </div>
        )}

        {showManual && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto border border-white/20 animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-2xl italic uppercase text-slate-800 tracking-tighter">{editingFoodId ? "Edit Item" : "New Food"}</h3>
                <button onClick={() => { setShowManual(false); setEditingFoodId(null); }} className="text-slate-300 hover:text-slate-800 font-black text-xl">✕</button>
              </div>
              <form onSubmit={handleManualSubmit} className="space-y-5">
                <input required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100 transition-all" value={manualFood.name} onChange={e => setManualFood({...manualFood, name: e.target.value})} placeholder="Item Name" />
                <div className="grid grid-cols-2 gap-4 bg-indigo-50/30 p-5 rounded-[2rem] border border-indigo-50">
                  {['servingSize', 'calories', 'protein', 'carbs', 'fiber'].map(field => (
                    <div key={field} className={field === 'servingSize' ? 'col-span-2' : ''}>
                      <label className="text-[9px] font-black text-indigo-300 block mb-1 uppercase tracking-tighter">{field}</label>
                      <input required type="number" step="0.1" className="w-full bg-white p-3 rounded-xl text-sm font-black outline-none" value={(manualFood as any)[field]} onChange={e => setManualFood({...manualFood, [field]: e.target.value})} />
                    </div>
                  ))}
                </div>
                {!editingFoodId && (
                  <div className="p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 text-center">
                    <label className="text-[10px] font-black text-emerald-400 block mb-2 uppercase italic">Portion Eaten (g)</label>
                    <input required type="number" className="w-full bg-white p-4 rounded-xl font-black text-emerald-600 outline-none text-center text-xl shadow-sm" value={manualFood.actualEat} onChange={e => setManualFood({...manualFood, actualEat: e.target.value})} />
                  </div>
                )}
                <button type="submit" className="w-full py-5 font-black text-white bg-slate-900 rounded-2xl shadow-xl hover:bg-indigo-600 transition-all uppercase text-xs tracking-[0.2em] mt-4">{editingFoodId ? "Update" : "Save & Add"}</button>
              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}