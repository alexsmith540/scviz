var RadialFreqViz = function($el,analyser){
  this.analyser = analyser;
  this.$el = $el;
  this.width = this.$el.width();
  this.height = this.$el.height();
  this.svg = d3.select(this.$el[0]).append('svg')
    .attr('width',this.width)
    .attr('height',this.height);
  this.circleG = this.svg.append('svg:g')
    .attr('transform','translate('+this.width/2+','+this.height/2+')')
  this.constructFrequencyBins();
  this.innerRadius = 200;
  var dim = this.height < this.width ? this.height : this.width;
  this.innerRadius = dim * 0.70/2;
  this.outerRadius = dim*0.98/2;
  this.lineLengthScale = d3.scale.linear()
    .range([0,this.outerRadius-this.innerRadius])
    .domain([0,0]);
  this.cubeLengthScale = d3.scale.linear()
    .range([1,30])
    .domain([0,0])
  this.barColorInterpolation = d3.interpolateLab('#00cc00','#11ccee');
  this.barColorScale = d3.scale.linear()
    .range([0,1])
    .domain([0,0]);
  this.durationScale = d3.scale.linear()
    .range([6,354])
    .domain([0,0]);
  this.initThree();
  this.listenToAnalyser();
  var _this = this;
  window.onresize = function(){
    _this.onResize();
  }
}
RadialFreqViz.prototype.onResize = function(){
  this.width = this.$el.width();
  this.height = this.$el.height();
  this.svg.attr('width',this.width).attr('height',this.height);
  this.circleG.attr('transform','translate('+this.width/2+','+this.height/2+')')
  var dim = this.height < this.width ? this.height : this.width;
  this.innerRadius = dim * 0.70/2;
  this.outerRadius = dim*0.98/2;
  this.lineLengthScale.range([0,this.outerRadius-this.innerRadius]);
  $(this.container).css('width',this.width).css('height',this.height);
  this.renderer.setSize(window.innerWidth, window.innerHeight);
  this.camera.aspect = window.innerWidth/window.innerHeight;

  //on resize...
  this.trackArcPast
    .innerRadius(this.innerRadius*0.96)
    .outerRadius(this.innerRadius*0.97);
  this.trackArcFuture
    .innerRadius(this.innerRadius*0.96)
    .outerRadius(this.innerRadius*0.97);
  this.trackArcNow
    .innerRadius(this.innerRadius*0.96)
    .outerRadius(this.innerRadius*0.97)
  this.trackArcHover
    .innerRadius(this.innerRadius*0.96)
    .outerRadius(this.innerRadius*0.97);
  this.pastPath
    .attr('d',this.trackArcPast);
  this.futurePath
    .attr('d',this.trackArcFuture);
  this.nowPath
    .attr('d',this.trackArcNow);
  this.mouseOverArc
    .innerRadius(this.innerRadius*0.90)
    .outerRadius(this.innerRadius*1.10);
  var _this = this;
  this.hoverPath
    .attr('d',this.trackArcHover);
  this.mouseOverPath
    .attr('d',this.mouseOverArc)
  this.timeLegend
    .attr('x',function(d){
      return Math.sin(0) * _this.innerRadius*0.98;
    })
    .attr('y',function(d){
      return Math.cos(0) * _this.innerRadius*0.98;
    })
    
}
RadialFreqViz.prototype.initThree = function(){
  this.cubeDim = 0.05;
  this.container = document.createElement('div');
  document.body.appendChild(this.container);

  // renderer
      
  this.scene = new THREE.Scene();
  this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1,1000 );
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(window.innerWidth, window.innerHeight);
  this.container.appendChild(this.renderer.domElement);
  //this.controls = new THREE.TrackballControls(this.camera, this.renderer.domElement);
  this.camera.position = new THREE.Vector3(0,0,0)
  this.camera.position.setZ(10);
  this.camera.lookAt(new THREE.Vector3(0,0,0));
  this.geo = new THREE.IcosahedronGeometry(3,3,3);
  this.cubeGroup = new THREE.Object3D();
  this.mat = new THREE.MeshBasicMaterial({color:0x666666,transparent:true,opacity:0.1,wireframe:true})
  this.testMesh = new THREE.Mesh(this.geo,this.mat)
  this.scene.add(this.testMesh);
  this.scene.add(this.cubeGroup);
  
  var cubeGeo = new THREE.BoxGeometry(this.cubeDim,this.cubeDim,this.cubeDim);
  var _this = this;
  this.geo.vertices.forEach(function(x,i){
    var cubeMat = new THREE.MeshBasicMaterial({color:0x00bb00,transparent:true,opacity:0.5})
    var mesh = new THREE.Mesh(cubeGeo,cubeMat);
    mesh.position.copy(x);
    mesh.lookAt(new THREE.Vector3(0,0,0))
    mesh.scale.setZ( Math.random()*10 );
    _this.cubeGroup.add(mesh);
  })
  //this.renderer.render(this.scene,this.camera);
  this.initPostProcessing();
}
RadialFreqViz.prototype.initPostProcessing = function(){
  var renderer = this.renderer;
  renderer.autoClear = false;
  var scene = this.scene;
  var camera = this.camera;
  var renderTargetParameters = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBFormat,
    stencilBuffer: false
  };
  var SCREEN_WIDTH = this.width;
  var SCREEN_HEIGHT = this.height;
  renderTarget = new THREE.WebGLRenderTarget( SCREEN_WIDTH, SCREEN_HEIGHT, renderTargetParameters );

  effectSave = new THREE.SavePass( new THREE.WebGLRenderTarget( SCREEN_WIDTH, SCREEN_HEIGHT, renderTargetParameters ) );
  effectSave.enabled = true;

  effectBlend = new THREE.ShaderPass( THREE.BlendShader, "tDiffuse1" );
  effectBlend.enabled = true;
  effectFXAA = new THREE.ShaderPass( THREE.FXAAShader );
  var effectVignette = new THREE.ShaderPass( THREE.VignetteShader );
  var effectBleach = new THREE.ShaderPass( THREE.BleachBypassShader );
  effectBloom = new THREE.BloomPass( 4.15 );

  effectFXAA.uniforms[ 'resolution' ].value.set( 1 / SCREEN_WIDTH, 1 / SCREEN_HEIGHT );

  // tilt shift

  hblur = new THREE.ShaderPass( THREE.HorizontalTiltShiftShader );
  vblur = new THREE.ShaderPass( THREE.VerticalTiltShiftShader );

  var bluriness = 0.15;

  hblur.uniforms[ 'h' ].value = bluriness / SCREEN_WIDTH;
  vblur.uniforms[ 'v' ].value = bluriness / SCREEN_HEIGHT;

  

  hblur.uniforms[ 'r' ].value = vblur.uniforms[ 'r' ].value = 0.35;

  
  effectVignette.uniforms[ "offset" ].value = 1.05;
  effectVignette.uniforms[ "darkness" ].value = 1.5;

  // motion blur

  effectBlend.uniforms[ 'tDiffuse2' ].value = effectSave.renderTarget;
  effectBlend.uniforms[ 'mixRatio' ].value = 0.65;

  var renderModel = new THREE.RenderPass( scene, camera );

  effectVignette.renderToScreen = true;

  this.composer = new THREE.EffectComposer( renderer, renderTarget );

  this.composer.addPass( renderModel );

  this.composer.addPass( effectFXAA );

  this.composer.addPass( effectBlend );
  this.composer.addPass( effectSave );

  this.composer.addPass( effectBloom );
  this.composer.addPass( effectBleach );

  this.composer.addPass( hblur );
  this.composer.addPass( vblur );

  this.composer.addPass( effectVignette );


}
RadialFreqViz.prototype.loopThreeCubes = function(frequencies){
  var _this = this;

  var intervalRatio = frequencies.length > this.geo.vertices.length ? 1 : Math.floor(this.geo.vertices.length / frequencies.length);
  intervalRatio = intervalRatio <= 0.9999 ? 1 : intervalRatio;
  this.cubeGroup.children.forEach(function(x,i){
    x.scale.setZ( 1 );
    var v3 = _this.geo.vertices[i]
    x.position.copy( _this.cartAddScale(v3,x.scale.z) );
  })
  var freqI = 0;
  for(i=0;i<this.cubeGroup.children.length;i+=intervalRatio){
    var x = this.cubeGroup.children[i];
    if(freqI > frequencies.length){
      x.scale.setZ( 1 );
      
    }
    else {
      x.scale.setZ( _this.cubeLengthScale(frequencies[freqI]) )
      //adjust position because we need to go spherical for a second since center of cube is on the surface...
      var v3 = _this.geo.vertices[i]
      x.position.copy( _this.cartAddScale(v3,x.scale.z) );
      /*var color = _this.barColorInterpolation( _this.barColorScale(frequencies[freqI]) );
      if(color != '#000000') console.log('color',color);
      x.material.color.setStyle(color);*/
      x.material.opacity = _this.barColorScale(frequencies[freqI]);
      x.material.color.b = _this.barColorScale(frequencies[freqI]);
      x.material.color.g = 1.0 - _this.barColorScale(frequencies[freqI]);
      x.material.color.r = 0.5 + _this.barColorScale(frequencies[freqI]);
    }
    freqI++;
  }
  
  this.cubeGroup.rotation.x += 0.01;
  this.cubeGroup.rotation.y += 0.01;
  this.testMesh.rotation.x += 0.01;
  this.testMesh.rotation.y += 0.01;
  if(typeof this.cameraInc == "undefined") this.cameraInc = {x:0.05,y:0.05,z:0.05};
  /*this.camera.position.z += this.cameraInc;
  if(this.camera.position.z > 20) this.cameraInc = -0.5;
  if(this.camera.position.z < -20) this.cameraInc = 0.5;
  this.camera.lookAt(new THREE.Vector3(0,0,0))*/
  $.each(this.cameraInc,function(k,v){
    _this.camera.position[k] += v;
    if(_this.camera.position[k] > 5) _this.cameraInc[k] *= -1;
    if(_this.camera.position[k] < -5) _this.cameraInc[k] *= -1;
  })
  
  //this.renderer.render(this.scene,this.controls.object);
  //this.renderer.render(this.scene,this.camera);
  this.renderer.autoClear = false;
  this.renderer.shadowMapEnabled = true;

  this.camera.lookAt(new THREE.Vector3(0,0,0));
  
  this.renderer.setRenderTarget( null );

  this.renderer.clear();
  this.composer.render( 0.1 );

  this.renderer.shadowMapEnabled = false;
  //this.controls.update();
  //this.controls.object.updateProjectionMatrix();
}
RadialFreqViz.prototype.cartAddScale = function(pos,addAltitude,radiusOverride){
  var altitude = 3;
  /*var phi = Math.atan2(pos.y,pos.x);
  var theta = Math.acos(pos.z / altitude)
  var rho = altitude + (addAltitude/2)*/
  
  var r = Math.sqrt(pos.x* pos.x + pos.y*pos.y+ pos.z*pos.z); 
  var phi = Math.asin(pos.z/r);
  var theta = Math.atan2(pos.y, pos.x);

  var rho = altitude + (addAltitude*this.cubeDim / 2)
  var x = Math.cos(phi) * Math.cos(theta) * rho
  var y = Math.cos(phi) * Math.sin(theta) * rho
  var z = Math.sin(phi) * rho
  return new THREE.Vector3(x,y,z);
}
RadialFreqViz.prototype.listenToAnalyser = function(){
  var _this = this;
  var freqDomain = new Uint8Array(this.analyser.frequencyBinCount);
  var sI = setInterval(function(){
    onInterval();
  },100);
  function onInterval(){
    
    _this.analyser.getByteFrequencyData(freqDomain);
    _this.redrawCircles(freqDomain);
    _this.drawSongLocation();
  }
}
RadialFreqViz.prototype.drawSongLocation = function(){
  if(typeof soundCloudStream != "undefined" && typeof currentTrack != "undefined" && typeof player != "undefined"){
    var dur = player.duration;
    var timeNow = player.currentTime;
    this.durationScale.domain([0,dur]);
    var deg = this.durationScale(timeNow);
    var x = Math.sin(this.deg2rad(deg)+Math.PI)* (this.innerRadius*0.98);
    var y = Math.cos(this.deg2rad(deg)+Math.PI)* (this.innerRadius*0.99);
    var arcBegin = 6;
    var arcEnd = 354;
    if(typeof this.trackArcPast == "undefined"){
      this.trackArcPast = d3.svg.arc()
        .innerRadius(this.innerRadius*0.96)
        .outerRadius(this.innerRadius*0.97)
        .startAngle(this.deg2rad(arcBegin)+Math.PI)
        .endAngle(this.deg2rad(arcBegin)+Math.PI)
      this.trackArcFuture = d3.svg.arc()
        .innerRadius(this.innerRadius*0.96)
        .outerRadius(this.innerRadius*0.97)
        .startAngle(this.deg2rad(arcBegin)+Math.PI)
        .endAngle(this.deg2rad(arcEnd)+Math.PI);
      this.trackArcNow = d3.svg.arc()
        .innerRadius(this.innerRadius*0.96)
        .outerRadius(this.innerRadius*0.97)
        .startAngle(this.deg2rad(arcBegin-0.5)+Math.PI)
        .endAngle(this.deg2rad(arcBegin+0.5)+Math.PI);
      this.trackArcHover = d3.svg.arc()
        .innerRadius(this.innerRadius*0.96)
        .outerRadius(this.innerRadius*0.97)
        .startAngle(this.deg2rad(arcBegin-0.5)+Math.PI)
        .endAngle(this.deg2rad(arcBegin+ 0.5)+Math.PI);
      this.pastPath = this.circleG.append('path')
        .classed('trackArcPast',true)
        .attr('d',this.trackArcPast);
      this.futurePath = this.circleG.append('path')
        .classed('trackArcFuture',true)
        .attr('d',this.trackArcFuture);
      this.nowPath = this.circleG.append('path')
        .classed('trackArcNow',true)
        .attr('d',this.trackArcNow);
      this.mouseOverArc = d3.svg.arc()
        .innerRadius(this.innerRadius*0.90)
        .outerRadius(this.innerRadius*1.10)
        .startAngle(this.deg2rad(arcBegin)+Math.PI)
        .endAngle(this.deg2rad(arcEnd)+Math.PI);
      var _this = this;
      this.hoverPath = this.circleG.append('path')
        .classed('hoverTrackPath',true)
        .attr('d',this.trackArcHover);
      this.mouseOverPath = this.circleG.append('path')
        .classed('mousePath',true)
        .attr('d',this.mouseOverArc)
        .on('mousemove',function(d){
          var coords = d3.mouse(this);
          var degs = _this.rad2deg( Math.atan2(coords[1],coords[0]) );
          console.log('some deg',degs);
          _this.trackArcHover
            .startAngle(_this.deg2rad(degs+90-1.5))
            .endAngle(_this.deg2rad(degs+90+1.5));

          _this.pastPath.attr('d',_this.trackArcPast);
          _this.hoverPath.attr('d',_this.trackArcHover)
            .classed('hoverShow',true);
        })
        .on('mouseleave',function(d){
          _this.hoverPath.classed('hoverShow',false);
        })
        .on('click',function(d){
          var coords = d3.mouse(this);
          var degs = _this.rad2deg( Math.atan2(coords[1],coords[0]) );
          var current = _this.durationScale.invert(degs+270);
          console.log('current',current,degs);
          player.currentTime = current;
        });

      this.timeLegend = this.circleG.append('text')
        .classed('timeLegend',true)
        .attr('text-anchor','middle')
        .attr('x',function(d){
          return Math.sin(0) * _this.innerRadius*0.98;
        })
        .attr('y',function(d){
          return Math.cos(0) * _this.innerRadius*0.98;
        })
        .text(function(d){
          var mm = Math.floor(player.currentTime/60);
          var ss = Math.floor(player.currentTime%60);
          var ms = ss - player.currentTime%60;
          mm = mm < 10 ? '0'+mm : mm;
          ss = ss < 10 ? '0'+ss : ss;
          ms = Math.floor(ms*100)
          return [mm,ss].join(':')
        })
    }
    var nowRadians = this.deg2rad(deg)+Math.PI;
    if(!isNaN(nowRadians)){
      this.trackArcPast.endAngle(nowRadians);
      this.trackArcNow
        .startAngle(this.deg2rad(deg-0.5)+Math.PI)
        .endAngle(this.deg2rad(deg+0.5)+Math.PI);
      this.trackArcFuture.startAngle(nowRadians);
      this.pastPath.attr('d',this.trackArcPast);
      this.futurePath.attr('d',this.trackArcFuture);
      this.nowPath.attr('d',this.trackArcNow);
      this.timeLegend
        .text(function(d){
          var mm = Math.floor(player.currentTime/60);
          var ss = Math.floor(player.currentTime%60);
          var ms = ss - player.currentTime%60;
          mm = mm < 10 ? '0'+mm : mm;
          ss = ss < 10 ? '0'+ss : ss;
          ms = Math.abs(Math.floor(ms*100/10)*10);
          ms = ms >= 100 ? '00' : ms < 10 ? '0'+ms : ms;
          return [mm,ss].join(':')
        })
    }


  }
}
RadialFreqViz.prototype.shuffle = function(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}
RadialFreqViz.prototype.redrawCircles = function(frequencies){
  var filter = Array.prototype.filter;
  var allFreq = frequencies.subarray()
  var frequencies = filter.call(frequencies,function(x,i){
    return x > 0;
  });
  this.loopThreeCubes(allFreq);
  var lineScaleMin = d3.min(frequencies);
  var lineScaleMax = d3.max(frequencies);
  var _this = this;
  var intRadians = this.deg2rad(360 / frequencies.length);
  this.lineLengthScale.domain([lineScaleMin,lineScaleMax]);
  this.cubeLengthScale.domain([d3.min(allFreq),lineScaleMax]);
  this.barColorScale.domain([d3.min(allFreq),lineScaleMax]);
  
  var freqLines = this.circleG.selectAll('line.freqLine')
    .data(frequencies);
  freqLines.attr('x1',function(d,i){
    
    return Math.cos(i*intRadians+Math.PI/2) * _this.innerRadius;
  })
  .attr('x2',function(d,i){
    var length = _this.lineLengthScale(d);
    return Math.cos(i*intRadians+Math.PI/2) * (_this.innerRadius + length );
  })
  .attr('y1',function(d,i){
    
    return Math.sin(i*intRadians+Math.PI/2) * _this.innerRadius;
  })
  .attr('y2',function(d,i){
    var length = _this.lineLengthScale(d);
    return Math.sin(i*intRadians+Math.PI/2) * (_this.innerRadius + length );
  });
  freqLines.enter()
    .append('line')
    .classed('freqLine',true)
    .attr('x1',function(d,i){
      
      return Math.cos(i*intRadians+Math.PI/2) * _this.innerRadius;
    })
    .attr('x2',function(d,i){
      var length = _this.lineLengthScale(d);
      return Math.cos(i*intRadians+Math.PI/2) * (_this.innerRadius + length );
    })
    .attr('y1',function(d,i){
      
      return Math.sin(i*intRadians+Math.PI/2) * _this.innerRadius;
    })
    .attr('y2',function(d,i){
      var length = _this.lineLengthScale(d);
      return Math.sin(i*intRadians+Math.PI/2) * (_this.innerRadius + length );
    });
  freqLines.exit().remove();
  //hey lets do some three
}
RadialFreqViz.prototype.constructFrequencyBins = function(){

}
RadialFreqViz.prototype.rad2deg = function(rad){
  return rad / 0.017453292519943295;
}
RadialFreqViz.prototype.deg2rad = function(angle) {
  //  discuss at: http://phpjs.org/functions/deg2rad/
  // original by: Enrique Gonzalez
  // improved by: Thomas Grainger (http://graingert.co.uk)
  //   example 1: deg2rad(45);
  //   returns 1: 0.7853981633974483

  return angle * 0.017453292519943295; // (angle / 180) * Math.PI;
}