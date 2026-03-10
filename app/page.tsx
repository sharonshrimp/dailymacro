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

// --- 常用食材組件 ---
function SortableFoodItem({ food, onSelect, onEdit, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: food.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 mb-3 group">
      <div {...attributes} {...listeners} className="cursor-grab p-2 text-slate-300 hover:text-indigo-400">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8h16M4 16h16"></path></svg>
      </div>

      <button onClick={() => onSelect(food)} className="flex-1 text-left p-4 bg-white border-2 border-slate-50 rounded-[1.5rem] shadow-sm hover:border-indigo-100 transition-all">
        <div className="flex justify-between items-center mb-1">
          <span className="font-black text-slate-700 italic">{food.name}</span>
          <span className="text-[10px] text-slate-400 font-bold">{food.servingSize}g</span>
        </div>
        <div className="flex gap-3 text-[10px] font-black uppercase tracking-tighter">
          <span className="text-indigo-500">P: {food.protein}g</span>
          <span className="text-orange-400">C: {food.calories}kcal</span>
          <span className="text-emerald-500">Carbs: {food.carbs}g</span>
        </div>
      </button>

      <div className="flex flex-col gap-1">
        <button onClick={() => onEdit(food)} className="bg-indigo-50 text-indigo-500 p-2.5 rounded-xl hover:bg-indigo-500 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        </button>
        <button onClick={() => onDelete(food.id)} className="bg-red-50 text-red-400 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all">✕</button>
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
  const [manualFood, setManualFood] = useState({ 
    name: '', calories: '', protein: '', carbs: '', fiber: '', servingSize: '100', actualEat: '100' 
  });

  const PROTEIN_GOAL = 100;

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

  const addNutrients = (name: string, data: any) => {
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
          calories: (dayData.totals.calories || 0) + newItem.calories,
          protein: Math.round(((dayData.totals.protein || 0) + newItem.protein) * 10) / 10,
          carbs: Math.round(((dayData.totals.carbs || 0) + newItem.carbs) * 10) / 10,
          fiber: Math.round(((dayData.totals.fiber || 0) + newItem.fiber) * 10) / 10,
        },
        items: [newItem, ...dayData.items]
      }
    };
    setHistory(newHistory);
    syncToCloud(newHistory, myFoods);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const foodItem = {
      id: editingFoodId || Date.now(),
      name: manualFood.name,
      calories: Number(manualFood.calories),
      protein: Number(manualFood.protein),
      carbs: Number(manualFood.carbs),
      fiber: Number(manualFood.fiber),
      servingSize: Number(manualFood.servingSize)
    };

    let newMyFoods = [...myFoods];
    if (editingFoodId) {
      newMyFoods = myFoods.map(f => f.id === editingFoodId ? foodItem : f);
    } else {
      newMyFoods = [foodItem, ...myFoods];
      // 只有在「新增」時才自動加入今日 Log
      const ratio = Number(manualFood.actualEat) / foodItem.servingSize;
      addNutrients(foodItem.name, {
        calories: foodItem.calories * ratio,
        protein: foodItem.protein * ratio,
        carbs: foodItem.carbs * ratio,
        fiber: foodItem.fiber * ratio,
        weight: manualFood.actualEat
      });
    }

    setMyFoods(newMyFoods);
    syncToCloud(history, newMyFoods);
    setShowManual(false);
    setEditingFoodId(null);
    setManualFood({ name: '', calories: '', protein: '', carbs: '', fiber: '', servingSize: '100', actualEat: '100' });
  };

  const handleEdit = (food: any) => {
    setEditingFoodId(food.id);
    setManualFood({
      name: food.name,
      calories: food.calories.toString(),
      protein: food.protein.toString(),
      carbs: food.carbs.toString(),
      fiber: food.fiber.toString(),
      servingSize: food.servingSize.toString(),
      actualEat: food.servingSize.toString()
    });
    setShowManual(true);
  };

  if (dbLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-indigo-200">SYNCING...</div>;

  return (
    <main className="min-h-screen bg-[#F8FAFF] p-4 pb-24 font-sans text-slate-900">
      <div className="max-w-md mx-auto">
        
        {/* Header: 全部營養素進度條 */}
        <div className="bg-white rounded-[3rem] shadow-xl p-8 mb-6 border border-indigo-50">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-4xl font-black text-slate-800">{dayData.totals.protein}g</h2>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">Protein Intake</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-slate-600">{dayData.totals.calories} kcal</p>
              <div className="flex gap-2 text-[8px] font-black text-slate-300 uppercase italic">
                <span>C: {dayData.totals.carbs}g</span>
                <span>F: {dayData.totals.fiber}g</span>
              </div>
            </div>
          </div>
          <div className="h-4 w-full bg-slate-50 rounded-full p-1">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${dayData.totals.protein >= PROTEIN_GOAL ? 'bg-amber-400' : 'bg-indigo-600'}`}
              style={{ width: `${Math.min((dayData.totals.protein / PROTEIN_GOAL) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* 搜尋與新增 */}
        <div className="flex gap-2 mb-6">
          <input className="flex-1 px-6 py-4 bg-white shadow-sm rounded-2xl font-bold outline-none" placeholder="Search..." value={query} onChange={e => setQuery(e.target.value)} />
          <button onClick={() => { setEditingFoodId(null); setShowManual(true); }} className="bg-slate-900 text-white w-14 h-14 rounded-2xl font-black text-2xl">+</button>
        </div>

        {/* 常用食材 */}
        <div className="mb-8">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Favorites</h3>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={myFoods.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {myFoods.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).map(food => (
                <SortableFoodItem key={food.id} food={food} onSelect={setSelectedFood} onEdit={handleEdit} onDelete={(id: any) => {
                  if(confirm("Delete this?")) {
                    const newF = myFoods.filter(f => f.id !== id);
                    setMyFoods(newF);
                    syncToCloud(history, newF);
                  }
                }} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* 今日記錄 */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2 italic">Today's Logs</h3>
          {dayData.items.map((item: any) => (
            <div key={item.id} className="bg-white/60 p-4 rounded-2xl flex justify-between items-center border border-white">
              <div>
                <p className="font-black text-slate-700 text-sm italic">{item.name}</p>
                <p className="text-[8px] font-bold text-slate-400">{item.weight}g · P: {item.protein}g · C: {item.carbs}g</p>
              </div>
              <button onClick={() => {
                const newItems = dayData.items.filter((i: any) => i.id !== item.id);
                const newHistory = {
                  ...history,
                  [selectedDate]: {
                    totals: {
                      calories: dayData.totals.calories - item.calories,
                      protein: Math.round((dayData.totals.protein - item.protein) * 10) / 10,
                      carbs: Math.round((dayData.totals.carbs - (item.carbs || 0)) * 10) / 10,
                      fiber: Math.round((dayData.totals.fiber - (item.fiber || 0)) * 10) / 10,
                    },
                    items: newItems
                  }
                };
                setHistory(newHistory);
                syncToCloud(newHistory, myFoods);
              }} className="text-slate-200 hover:text-red-400 font-bold">✕</button>
            </div>
          ))}
        </div>

        {/* 重量彈窗 */}
        {selectedFood && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl">
              <h3 className="text-xl font-black text-center mb-6">{selectedFood.name}</h3>
              <div className="bg-indigo-50 rounded-[2rem] p-8 mb-6 text-center">
                <input autoFocus type="number" className="w-32 text-5xl font-black text-center bg-transparent border-b-4 border-indigo-500 outline-none text-indigo-600" value={weight} onChange={e => setWeight(e.target.value)} />
                <span className="text-xl font-black text-indigo-300 ml-2">g</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setSelectedFood(null)} className="py-4 font-black text-slate-400 bg-slate-100 rounded-2xl">Cancel</button>
                <button onClick={() => {
                  const r = Number(weight) / selectedFood.servingSize;
                  addNutrients(selectedFood.name, { calories: selectedFood.calories * r, protein: selectedFood.protein * r, carbs: selectedFood.carbs * r, fiber: selectedFood.fiber * r, weight: weight });
                  setSelectedFood(null); setWeight('100');
                }} className="py-4 font-black text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">Add</button>
              </div>
            </div>
          </div>
        )}

        {/* 新增/編輯彈窗 */}
        {showManual && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="font-black text-xl italic mb-6 uppercase text-slate-800">{editingFoodId ? "Edit Food" : "Quick Add"}</h3>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 italic">Food Name</label>
                  <input required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100 transition-all" value={manualFood.name} onChange={e => setManualFood({...manualFood, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-4 rounded-3xl">
                  {['servingSize', 'calories', 'protein', 'carbs', 'fiber'].map(field => (
                    <div key={field}>
                      <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase italic">{field}</label>
                      <input required type="number" step="0.1" className="w-full bg-white p-2 rounded-xl text-sm font-bold outline-none" value={(manualFood as any)[field]} onChange={e => setManualFood({...manualFood, [field]: e.target.value})} />
                    </div>
                  ))}
                </div>
                {!editingFoodId && (
                  <div className="p-4 bg-emerald-50 rounded-3xl">
                    <label className="text-[8px] font-black text-emerald-500 block mb-2 text-center italic uppercase">Actually Eaten (g)</label>
                    <input required type="number" className="w-full bg-white p-3 rounded-xl font-black text-emerald-600 text-center outline-none" value={manualFood.actualEat} onChange={e => setManualFood({...manualFood, actualEat: e.target.value})} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button type="button" onClick={() => { setShowManual(false); setEditingFoodId(null); }} className="p-4 font-black text-slate-400 bg-slate-100 rounded-2xl">Cancel</button>
                  <button type="submit" className="p-4 font-black text-white bg-slate-900 rounded-2xl shadow-lg">{editingFoodId ? "Update" : "Save & Add"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}