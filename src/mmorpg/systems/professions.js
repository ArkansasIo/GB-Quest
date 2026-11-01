export function createProfessionState(){return {skills:{},knownRecipes:[],gatheringNodes:{}};}
export function learnRecipe(state,recipeId){if(state.knownRecipes.includes(recipeId))return false;state.knownRecipes.push(recipeId);return true;}
export function canCraft(state,recipe,inventory){if(!state.knownRecipes.includes(recipe.id))return {ok:false,reason:"recipe_unknown"};for(const ingredient of recipe.ingredients||[])if((inventory.items.find(x=>x.id===ingredient.id)?.quantity||0)<ingredient.quantity)return {ok:false,reason:"missing_materials"};return {ok:true};}
