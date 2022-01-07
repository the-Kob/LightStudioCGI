import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../LightStudioCGI/libs/utils.js";
import { perspective, lookAt, flatten, vec2, vec3, vec4, normalMatrix, length, subtract, mult, scale, inverse, rotate, rotateX, rotateY, rotateZ } from "../LightStudioCGI/libs/MV.js";
import { modelView, loadMatrix, multScale, multTranslation, pushMatrix, popMatrix } from "../LightStudioCGI/libs/stack.js";

import * as dat from "../LightStudioCGI/libs/dat.gui.module.js";

import * as CUBE from '../LightStudioCGI/libs/cube.js';
import * as CYLINDER from '../LightStudioCGI/libs/cylinder.js';
import * as PYRAMID from '../LightStudioCGI/libs/pyramid.js';
import * as SPHERE from '../LightStudioCGI/libs/sphere.js';
import * as TORUS from '../LightStudioCGI/libs/torus.js';

/** @type WebGLRenderingContext */
let gl;
     
let mode;

let rotating = false;
let deltaTime = 0;
let speed = {speed: 100};

let clicking = false;
let clickPosX = 0;
let clickPosY = 0;

const RGB = 255;

const GROUND_SCALE_X_Z = 3.0;
const GROUND_SCALE_Y = 0.1;
const GROUND_Y_LVL = -GROUND_SCALE_Y/2 - 0.5;

const LIGHT_SCALE = 0.125;
const MAX_LIGHTS = 8;

let lights = [];
let lightFolders = [];

// These constants help decide if a light rotates in the X, Y or Z axis
const X_AXIS = 0;
const Y_AXIS = 1;
const Z_AXIS = 2;

function setup(shaders)
{   
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    // Interface
    
    let camera = {
        eye: vec3(5,2.5,5),
        at: vec3(0,0,0),
        up: vec3(0,1,0),
        fovy: 45,
        aspect: 1.0,
        near: 0.1,
        far: 20
    }

    let options = {
        wireframe: false,
        back_face_culling: true,
        depth_buffer: true,
        lights: false
    }

    let materialinfoground = {
        object: "Cube",
        ka: vec3(50, 50, 75),
        kd: vec3(125, 200, 215),
        ks: vec3(RGB, RGB, RGB),
        shininess: 50
    }

    let materialinfoprimitive = {
        object: "Sphere",
        ka: vec3(50, 50, 75),
        kd: vec3(125, 200, 215),
        ks: vec3(RGB, RGB, RGB),
        shininess: 50
    }

    let materialinfolight = {
        object: "Sphere",
        ka: vec3(RGB, RGB, RGB),
        kd: vec3(RGB, RGB, RGB),
        ks: vec3(RGB, RGB, RGB),
        shininess: 100
    }

    let newlightinfo = {
        active: true, // default value
        directional: false, // default value
        x: 0, // default value
        y: 1, // default value
        z: 0, // default value
        ia: vec3(75, 75, 75), // default value
        id: vec3(175, 175, 175), // default value
        is: vec3(RGB, RGB, RGB), // default value
        rotationAxis: -1 // default value
    }   

    const gui1 = new dat.GUI();

    const optionsGui = gui1.addFolder("Options");
    optionsGui.add(options, "wireframe");
    optionsGui.add(options, "back_face_culling");
    optionsGui.add(options, "depth_buffer");
    optionsGui.add(options, "lights");

    const cameraGui = gui1.addFolder("Camera");
    cameraGui.add(camera, "fovy").min(1).max(100).step(1).listen();
    cameraGui.add(camera, "aspect").min(0).max(10).step(0.1).listen().domElement.style.pointerEvents = "none";
    cameraGui.add(camera, "near").min(0.1).max(20).step(0.1).listen().onChange(function (v) {
        camera.near = Math.min(camera.far - 0.5, v);
    });
    cameraGui.add(camera, "far").min(0.1).max(20).step(0.1).listen().onChange(function (v) {
        camera.far = Math.min(camera.far + 0.5, v);
    });

    const eye = cameraGui.addFolder("Eye");
    eye.add(camera.eye, 0).step(0.05).listen().name("x");
    eye.add(camera.eye, 1).step(0.05).listen().name("y");
    eye.add(camera.eye, 2).step(0.05).listen().name("z");

    const at = cameraGui.addFolder("At");
    at.add(camera.at, 0).step(0.05).name("x");
    at.add(camera.at, 1).step(0.05).name("y");
    at.add(camera.at, 2).step(0.05).name("z");

    const up = cameraGui.addFolder("Up");
    up.add(camera.up, 0).step(0.05).name("x");
    up.add(camera.up, 1).step(0.05).name("y");
    up.add(camera.up, 2).step(0.05).name("z");

    const lightsGui = gui1.addFolder("Lights");

    let rotatelightsbutton = {rotateL:function() {
        if(lights.length > 0) {
            for(let i = 0; i < lights.length; i++) {
                if(lights[i].rotationAxis == -1) {
                    lights[i].rotationAxis = randomInteger(0, 2);
                } else {
                    window.alert("The lights are already rotating!/n The lights can rotate on all three axis (X, Y and Z), so it is possible the light is rotating and you just don't notice it, so try again!");
                    break;
                }
            }
            rotating = true;
        } else {
            window.alert("There are no lights to rotate!");
        }
    }};

    lightsGui.add(rotatelightsbutton, "rotateL").name("Rotate lights");

    let stoprotatelightsbutton = {notrotateL:function() {
        if(lights.length > 0) {
            for(let i = 0; i < lights.length; i++) {
                lights[i].rotationAxis = -1;
            }
            rotating = false;
        } else {
            window.alert("There are no lights!");
        }
    }};

    lightsGui.add(stoprotatelightsbutton, "notrotateL").name("Stop rotating lights");

    lightsGui.add(speed, "speed").min(1).max(200).step(1).listen().name("Rotation speed");

    const newLight = lightsGui.addFolder("New light");
    newLight.add(newlightinfo, "active");
    newLight.add(newlightinfo, "directional");
    newLight.add(newlightinfo, "x").step(0.05);
    newLight.add(newlightinfo, "y").step(0.05);
    newLight.add(newlightinfo, "z").step(0.05);
    newLight.addColor(newlightinfo, "ia");
    newLight.addColor(newlightinfo, "id");
    newLight.addColor(newlightinfo, "is");

    let addlightbutton = { add:function() {
        if(lights.length < MAX_LIGHTS) {
            let light = {...newlightinfo};
            if(rotating) {
                light.rotationAxis = randomInteger(0, 2);
            }
            lights.push(light);

            let currentLight = lights[lights.length - 1];
            const lightFolder = lightsGui.addFolder("Light " + lights.length);
            lightFolder.add(currentLight, "active");
            lightFolder.add(currentLight, "directional");
            lightFolder.add(currentLight, "x").step(0.05).listen();
            lightFolder.add(currentLight, "y").step(0.05).listen();
            lightFolder.add(currentLight, "z").step(0.05).listen();
            lightFolder.addColor(currentLight, "ia");
            lightFolder.addColor(currentLight, "id");
            lightFolder.addColor(currentLight, "is");

            lightFolders.push(lightFolder);
        } else {
            window.alert('You have reached the maximum number of lights.')
        }
    }};

    lightsGui.add(addlightbutton, "add").name("Add a new light");

    let removelastlightbutton = { remove:function() {
        if(lights.length > 0) {
            lightsGui.removeFolder(lightFolders[lights.length - 1]);
            lights.pop();
            lightFolders.pop();
            if(lights.length == 0) {
                rotating = false;
            }
            
        } else {
            window.alert('No lights have been added yet.')
        }
    }};

    lightsGui.add(removelastlightbutton, "remove").name("Remove last light");

    //Add an initial light
    let light = {...newlightinfo};
    if(rotating) {
        light.rotationAxis = randomInteger(0, 2);
    }
    lights.push(light);

    let currentLight = lights[lights.length - 1];
    const lightFolder = lightsGui.addFolder("Light " + lights.length);
    lightFolder.add(currentLight, "active");
    lightFolder.add(currentLight, "directional");
    lightFolder.add(currentLight, "x").step(0.05).listen();
    lightFolder.add(currentLight, "y").step(0.05).listen();
    lightFolder.add(currentLight, "z").step(0.05).listen();
    lightFolder.addColor(currentLight, "ia");
    lightFolder.addColor(currentLight, "id");
    lightFolder.addColor(currentLight, "is");

    lightFolders.push(lightFolder);
    
    const gui2 = new dat.GUI();

    const materialGui = gui2.addFolder("Material");
    materialGui.add(materialinfoprimitive, "object", ["Cube", "Cylinder", "Pyramid", "Sphere", "Torus"]);
    materialGui.addColor(materialinfoprimitive, "ka");
    materialGui.addColor(materialinfoprimitive, "kd");
    materialGui.addColor(materialinfoprimitive, "ks");
    materialGui.add(materialinfoprimitive, "shininess").min(0.1).max(100).step(0.1).listen();

    // End of Interface

    let mProjection = perspective(camera.fovy, aspect, camera.near, camera.far);

    let mView = lookAt(camera.eye, camera.at, camera.up);

    mode = gl.TRIANGLES;

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onwheel = function(event) {
        const sign = Math.sign(event.deltaY);

        if(event.ctrlKey == true) {
            camera.eye[2] += sign/10;
        } else if(event.shiftKey == true) {
            camera.eye[2] += sign/10;
            camera.at[2] += sign/10;
        } else {
            camera.fovy += sign;
        }
    };

    document.onmousedown = function(event) {
        clicking = true;
        clickPosX = event.clientX; 
        clickPosY = event.clientY;
    }

    document.onmouseup = function(event) {
        clicking = false;
    }

    document.onmousemove = function(event) {
        if(clicking == true) {
            let originalX = event.offsetX - clickPosX;
            let originalY = event.offsetY - clickPosY;
            let vec = scale(0.5, vec2(-originalY , -originalX));

            let worldCoord = mult(inverse(mView) , vec4(vec, 0, 0)) ;

            let finalVec = rotate(length(vec), worldCoord);

            let vecAtCamera = vec4(subtract(camera.eye, camera.at), 0);

            finalVec = mult(finalVec, vecAtCamera);

            camera.eye[0] = finalVec[0];
            camera.eye[1] = finalVec[1];
            camera.eye[2] = finalVec[2];
            console.log(camera.eye);

            clickPosX = event.offsetX;
            clickPosY = event.offsetY;
        }
    };

   gl.clearColor(0, 0, 0, 1); 
    
    CUBE.init(gl);
    CYLINDER.init(gl);
    PYRAMID.init(gl);
    SPHERE.init(gl);
    TORUS.init(gl);

    window.requestAnimationFrame(render);


    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection = perspective(camera.fovy, aspect, camera.near, camera.far);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mNormals"), false, flatten(normalMatrix(modelView())));
    }

    function randomInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    function Ground()
    {   
        materialInfoGround();

        pushMatrix();
            multTranslation([0, GROUND_Y_LVL, 0]);
            multScale([GROUND_SCALE_X_Z, GROUND_SCALE_Y, GROUND_SCALE_X_Z]);

            uploadModelView();

            CUBE.draw(gl, program, mode);
        popMatrix();
    }

    function Primitive()
    {   
        materialInfoPrimitive();

        pushMatrix();
            uploadModelView();

            switch(materialinfoprimitive.object) {
                case "Cube":
                    CUBE.draw(gl, program, mode);
                    break;
                case "Cylinder":
                    CYLINDER.draw(gl, program, mode);
                    break;
                case "Pyramid":
                    PYRAMID.draw(gl, program, mode);
                    break;
                case "Sphere":
                    SPHERE.draw(gl, program, mode);
                    break;
                case "Torus":
                    TORUS.draw(gl, program, mode);
                    break;
            }
        popMatrix();
    }

    function Light(i)
    {   
        materialInfoLight();

        pushMatrix();
            // Decide which axis to rotate if the "Rotate lights" button has been pressed
            const pos = vec4(lights[i].x, lights[i].y, lights[i].z, 1.0);
            let rot;
            
            switch(lights[i].rotationAxis) {
                case X_AXIS:
                    rot = rotateX(deltaTime * speed.speed);
                    lights[i].x = mult(rot, pos)[0];
                    lights[i].y = mult(rot, pos)[1];
                    lights[i].z = mult(rot, pos)[2];
                    break;
                case Y_AXIS:
                    rot = rotateY(deltaTime * speed.speed);
                    lights[i].x = mult(rot, pos)[0];
                    lights[i].y = mult(rot, pos)[1];
                    lights[i].z = mult(rot, pos)[2];
                    break;
                case Z_AXIS:
                    rot = rotateZ(deltaTime * speed.speed);
                    lights[i].x = mult(rot, pos)[0];
                    lights[i].y = mult(rot, pos)[1];
                    lights[i].z = mult(rot, pos)[2];
                    break;
                case -1:
                    break;
            }

            multTranslation([lights[i].x, lights[i].y, lights[i].z]);
            multScale([LIGHT_SCALE, LIGHT_SCALE, LIGHT_SCALE]);

            uploadModelView();
            if(options.lights) {
                SPHERE.draw(gl, program, gl.LINES);
            }
        popMatrix();
    }

    function Lights()
    {
        for(let i = 0; i < lights.length; i++) {   
            Light(i);
        }
    }

    function checkWireframe()
    {
        if(options.wireframe) {
            mode = gl.LINES;
        } else {
            mode = gl.TRIANGLES;
        }
    }

    function backFaceCulling()
    {
        if(options.back_face_culling) {
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);
        } else {
            gl.disable(gl.CULL_FACE);
        }
    }

    function depthTest()
    {
        if(options.depth_buffer) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
    }

    function nLightsInfo()
    {   
        const uNLights = gl.getUniformLocation(program, "uNLights");
        gl.uniform1i(uNLights, lights.length);
    }

    function lightInfo()
    { 
        for(let i = 0; i < lights.length; i++) {
            let pos = vec3(lights[i].x, lights[i].y, lights[i].z);

            const uIsActive = gl.getUniformLocation(program, "uLight[" + i + "].active");
            gl.uniform1i(uIsActive, lights[i].active);
            const uIsDirectional = gl.getUniformLocation(program, "uLight[" + i + "].directional");
            gl.uniform1i(uIsDirectional, lights[i].directional);
            const uPos = gl.getUniformLocation(program, "uLight[" + i + "].pos");
            gl.uniform3fv(uPos, flatten(pos));
            const uIa = gl.getUniformLocation(program, "uLight[" + i + "].ia");
            gl.uniform3fv(uIa, flatten(scale(1/RGB, lights[i].ia)));
            const uId = gl.getUniformLocation(program, "uLight[" + i + "].id");
            gl.uniform3fv(uId, flatten(scale(1/RGB, lights[i].id)));
            const uIs = gl.getUniformLocation(program, "uLight[" + i + "].is");
            gl.uniform3fv(uIs, flatten(scale(1/RGB, lights[i].is)));
        }
        
    }

    function materialInfoGround()
    {
        const uKa = gl.getUniformLocation(program, "uMaterial.ka");
        gl.uniform3fv(uKa, flatten(scale(1/RGB, materialinfoground.ka)));
        const uKd = gl.getUniformLocation(program, "uMaterial.kd");
        gl.uniform3fv(uKd, flatten(scale(1/RGB, materialinfoground.kd)));
        const uKs = gl.getUniformLocation(program, "uMaterial.ks");
        gl.uniform3fv(uKs, flatten(scale(1/RGB, materialinfoground.ks)));
        const uShininess = gl.getUniformLocation(program, "uMaterial.shininess");
        gl.uniform1f(uShininess, materialinfoground.shininess);
    }

    function materialInfoPrimitive()
    {
        const uKa = gl.getUniformLocation(program, "uMaterial.ka");
        gl.uniform3fv(uKa, flatten(scale(1/RGB, materialinfoprimitive.ka)));
        const uKd = gl.getUniformLocation(program, "uMaterial.kd");
        gl.uniform3fv(uKd, flatten(scale(1/RGB, materialinfoprimitive.kd)));
        const uKs = gl.getUniformLocation(program, "uMaterial.ks");
        gl.uniform3fv(uKs, flatten(scale(1/RGB, materialinfoprimitive.ks)));
        const uShininess = gl.getUniformLocation(program, "uMaterial.shininess");
        gl.uniform1f(uShininess, materialinfoprimitive.shininess);
    }

    function materialInfoLight()
    {
        const uKa = gl.getUniformLocation(program, "uMaterial.ka");
        gl.uniform3fv(uKa, flatten(scale(1/RGB, materialinfolight.ka)));
        const uKd = gl.getUniformLocation(program, "uMaterial.kd");
        gl.uniform3fv(uKd, flatten(scale(1/RGB, materialinfolight.kd)));
        const uKs = gl.getUniformLocation(program, "uMaterial.ks");
        gl.uniform3fv(uKs, flatten(scale(1/RGB, materialinfolight.ks)));
        const uShininess = gl.getUniformLocation(program, "uMaterial.shininess");
        gl.uniform1f(uShininess, materialinfolight.shininess);
    }

    function render()
    {
        if(rotating) deltaTime = 1/60;

        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        mProjection = perspective(camera.fovy, aspect, camera.near, camera.far);

        mView = lookAt(camera.eye, camera.at, camera.up);

        loadMatrix(mView);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mView"), false, flatten(mView));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mViewNormals"), false, flatten(normalMatrix(mView)));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        checkWireframe();
        backFaceCulling();
        depthTest();
        
        nLightsInfo();
        lightInfo();

        Ground();
        Primitive();
        Lights();
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders));
